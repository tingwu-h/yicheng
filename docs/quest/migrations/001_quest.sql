-- ==========================================================================
-- 驿程 · 任务提醒 / 金币 / 萌宠 迁移脚本 001
-- --------------------------------------------------------------------------
-- 适用范围：
--   本项目当前为纯前端演示版，没有数据库，用户态存在 localStorage。
--   本脚本是为「将来接入后端」准备的建表脚本，字段与
--   src/store/questStore.js 中的集合、src/services/questApi.js 中的接口一一对应。
--
-- 三条硬约束（与需求一致）：
--   1. 只新增表，**不修改任何既有表结构**（用户表 / 景点表 / 帖子表等一律不动）；
--      user_id、attraction_id 先作为字符串外键使用，接入既有表时再补外键约束。
--   2. 金币表没有「充值 / 提现 / 兑换现金」相关的任何字段或枚举值，
--      reason 只允许 complete / unlock / buy 三种，结构上杜绝变现。
--   3. 幂等键（idempotency_key）建唯一索引，保证同一任务每天只发一次金币。
--
-- 方言：MySQL 8.0（InnoDB / utf8mb4）。SQLite 只需去掉 ENGINE、CHARSET 与
--       COMMENT 子句即可，其余语法通用。
-- 回滚：见文件末尾的 000_rollback 注释块。
-- ==========================================================================

SET NAMES utf8mb4;

-- --------------------------------------------------------------------------
-- 1. 用户预录项目
--    对应 questApi.listPreItems / createPreItem / updatePreItem / deletePreItem
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `quest_pre_items` (
  `id`             VARCHAR(40)  NOT NULL COMMENT '主键，应用侧生成',
  `user_id`        VARCHAR(40)  NOT NULL COMMENT '用户 ID',
  `attraction_id`  VARCHAR(40)  NOT NULL COMMENT '景点 ID',
  `poi_id`         VARCHAR(60)      NULL COMMENT '来源 POI ID，自定义条目为空',
  `name`           VARCHAR(60)  NOT NULL COMMENT '项目名称，过敏感词表',
  `category`       VARCHAR(16)  NOT NULL DEFAULT 'spot'
                   COMMENT 'spot 想玩 / photo 想拍 / activity 想体验 / food 想吃',
  `expected_time`  VARCHAR(8)   NOT NULL DEFAULT '不限' COMMENT '不限/上午/中午/下午/傍晚/夜晚',
  `priority`       VARCHAR(8)   NOT NULL DEFAULT 'mid' COMMENT 'high 必去 / mid 想去 / low 随缘',
  `remind_enabled` TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '是否参与提醒；0 表示这一项完全静默',
  `status`         VARCHAR(12)  NOT NULL DEFAULT 'want' COMMENT 'want / done / skipped',
  `note`           VARCHAR(160)     NULL COMMENT '用户备注',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pre_user`       (`user_id`, `created_at`),
  KEY `idx_pre_attraction` (`attraction_id`),
  -- 同一景点下同一名称同一类型不重复添加（接口对重复添加返回友好提示而不是报错）
  UNIQUE KEY `uk_pre_unique` (`user_id`, `attraction_id`, `name`, `category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户预录项目（想玩/想拍/想体验/想吃）';

-- --------------------------------------------------------------------------
-- 2. 任务模板（后台可配置）
--    对应 src/data/questConfig.js 的 TASK_TEMPLATES，接入后台后由本表下发
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `quest_task_templates` (
  `id`            VARCHAR(40)  NOT NULL COMMENT '模板 ID，如 t-photo-spot',
  `title`         VARCHAR(60)  NOT NULL,
  `category`      VARCHAR(16)  NOT NULL COMMENT 'sight/photo/food/rest/queue/weather/family/record/prepare',
  `desc`          VARCHAR(240)     NULL COMMENT '任务卡说明文案',
  `steps`         JSON             NULL COMMENT '步骤数组，最多 3 条',
  `condition_text` VARCHAR(120)    NULL COMMENT '完成条件的自然语言描述',
  `pre_categories` JSON            NULL COMMENT '适合的预录项目类型，空数组表示通用任务',
  `trigger_type`  VARCHAR(16)  NOT NULL COMMENT 'time/location/weather/queue/duration',
  `trigger_params` JSON            NULL COMMENT '触发参数，如 {"slots":["傍晚"]}',
  `difficulty`    VARCHAR(8)   NOT NULL DEFAULT 'easy' COMMENT 'easy/normal/hard，决定金币数',
  `verify_type`   VARCHAR(12)  NOT NULL DEFAULT 'manual' COMMENT 'manual/location/scan',
  `pet_line_key`  VARCHAR(20)  NOT NULL DEFAULT 'suggest' COMMENT '萌宠话术键',
  `safety_tip`    VARCHAR(160)     NULL COMMENT '安全提示',
  `cooldown_min`  INT          NOT NULL DEFAULT 90 COMMENT '同模板冷却分钟数',
  `daily_limit`   INT          NOT NULL DEFAULT 1 COMMENT '每日最多出现次数',
  `enabled`       TINYINT(1)   NOT NULL DEFAULT 1,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tpl_enabled` (`enabled`, `category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务模板（可后台配置）';

-- --------------------------------------------------------------------------
-- 3. 任务记录（下发与完成都记在这里）
--    对应 questApi.nextTask / completeTask / snoozeTask / dismissToday
--                / notInterested / skipTask / listTaskRecords
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `quest_task_records` (
  `id`              VARCHAR(40)  NOT NULL,
  `user_id`         VARCHAR(40)  NOT NULL,
  `template_id`     VARCHAR(40)  NOT NULL,
  `pre_item_id`     VARCHAR(40)      NULL COMMENT '关联的预录项目，通用任务为空',
  `attraction_id`   VARCHAR(40)      NULL,
  `task_date`       DATE         NOT NULL COMMENT '归属日期，冷却与每日上限按它统计',
  `state`           VARCHAR(16)  NOT NULL DEFAULT 'surfaced'
                    COMMENT 'surfaced/completed/skipped/snoozed/dismissedToday/notInterested',
  `verify_method`   VARCHAR(12)      NULL COMMENT 'manual/location/scan',
  `verify_downgraded` TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '演示环境降级为手动确认时置 1',
  `coins_granted`   INT          NOT NULL DEFAULT 0,
  `idempotency_key` VARCHAR(80)  NOT NULL COMMENT 'task:{userId}:{templateId}:{date}',
  `surfaced_at`     DATETIME         NULL,
  `completed_at`    DATETIME         NULL,
  `snooze_until`    DATETIME         NULL,
  `context`         JSON             NULL COMMENT '触发时的场景快照（时段/天气/排队/在园时长）',
  PRIMARY KEY (`id`),
  KEY `idx_rec_user_date` (`user_id`, `task_date`),
  KEY `idx_rec_template`  (`template_id`, `task_date`),
  -- 同一模板同一天只有一个「已发放」幂等键，配合金币表保证不重复发币
  UNIQUE KEY `uk_rec_idem` (`idempotency_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务记录（下发/完成/跳过/稍后/不感兴趣）';

-- --------------------------------------------------------------------------
-- 4. 金币流水
--    对应 questApi.getCoins / completeTask / unlockPet / buyItem
--    注意：reason 只有三个枚举值，没有充值、提现、现金兑换。
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `quest_coin_ledger` (
  `id`              BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`         VARCHAR(40)  NOT NULL,
  `delta`           INT          NOT NULL COMMENT '正数为任务所得，负数为解锁/购买消耗',
  `balance_after`   INT          NOT NULL COMMENT '记账后余额，便于对账',
  `reason`          VARCHAR(12)  NOT NULL COMMENT 'complete 完成任务 / unlock 解锁萌宠 / buy 购买装扮',
  `ref_type`        VARCHAR(12)      NULL COMMENT 'task / pet / item',
  `ref_id`          VARCHAR(40)      NULL,
  `template_id`     VARCHAR(40)      NULL,
  `idempotency_key` VARCHAR(80)      NULL COMMENT '发币幂等键，唯一',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_coin_user` (`user_id`, `created_at`),
  -- 同一任务每天只能记一笔；消费类记录该列为空，不受唯一约束限制
  UNIQUE KEY `uk_coin_idem` (`idempotency_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='金币流水（不可充值、不可提现、不可兑换现金）';

-- --------------------------------------------------------------------------
-- 5. 萌宠（后台配置）
--    对应 src/data/pets.js 的 PETS
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `quest_pets` (
  `id`           VARCHAR(40)  NOT NULL COMMENT 'pet-qizai / pet-zhuhuan / pet-jinsihou / pet-lingniu',
  `name`         VARCHAR(20)  NOT NULL COMMENT '七仔 / 朱鹮 / 川金丝猴 / 羚牛',
  `species`      VARCHAR(30)  NOT NULL COMMENT '棕色大熊猫 / 朱鹮 / 川金丝猴 / 羚牛',
  `subtitle`     VARCHAR(80)      NULL,
  `personality`  VARCHAR(20)  NOT NULL COMMENT '憨厚治愈 / 优雅温柔 / 活泼好动 / 憨厚可靠',
  `skill`        VARCHAR(12)  NOT NULL COMMENT '鼓励 / 拍照 / 游玩 / 休息与吃食',
  `skill_label`  VARCHAR(40)      NULL,
  `lines`        JSON         NOT NULL COMMENT '各场景话术，键为 petLineKey',
  `palette`      JSON         NOT NULL COMMENT '程序化 SVG 配色',
  `unlock_cost`  INT          NOT NULL DEFAULT 0 COMMENT '解锁所需金币，0 表示初始萌宠',
  `is_default`   TINYINT(1)   NOT NULL DEFAULT 0,
  `enabled`      TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='萌宠（秦岭四宝）配置';

-- --------------------------------------------------------------------------
-- 6. 萌宠装扮（后台配置）
--    对应 src/data/pets.js 的 PET_ITEMS
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `quest_pet_items` (
  `id`      VARCHAR(40)  NOT NULL,
  `name`    VARCHAR(30)  NOT NULL,
  `slot`    VARCHAR(8)   NOT NULL COMMENT 'back 披风 / outfit 外袍 / hat 冠饰',
  `style`   VARCHAR(16)  NOT NULL COMMENT 'SVG 层样式键：tang/armor/leaf/feather/vine/rock…',
  `pet_id`  VARCHAR(40)      NULL COMMENT '专属装扮所属萌宠；NULL 表示通用',
  `price`   INT          NOT NULL DEFAULT 0 COMMENT '只能用任务金币购买',
  `desc`    VARCHAR(120)     NULL,
  `enabled` TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_item_pet` (`pet_id`),
  CONSTRAINT `fk_item_pet` FOREIGN KEY (`pet_id`) REFERENCES `quest_pets` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='萌宠装扮（仅可用任务金币购买）';

-- --------------------------------------------------------------------------
-- 7. 用户萌宠与穿搭
--    对应 questApi.listPets / unlockPet / activatePet / equipItem / unequipSlot
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `quest_user_pets` (
  `user_id`     VARCHAR(40) NOT NULL,
  `pet_id`      VARCHAR(40) NOT NULL,
  `unlocked_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `pet_id`),
  CONSTRAINT `fk_upet_pet` FOREIGN KEY (`pet_id`) REFERENCES `quest_pets` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户已解锁萌宠';

CREATE TABLE IF NOT EXISTS `quest_user_pet_items` (
  `user_id`    VARCHAR(40) NOT NULL,
  `item_id`    VARCHAR(40) NOT NULL,
  `bought_at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `item_id`),
  CONSTRAINT `fk_uitem_item` FOREIGN KEY (`item_id`) REFERENCES `quest_pet_items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户已购买的装扮';

CREATE TABLE IF NOT EXISTS `quest_user_loadouts` (
  `user_id`    VARCHAR(40) NOT NULL,
  `pet_id`     VARCHAR(40) NOT NULL,
  `back_item`  VARCHAR(40)     NULL COMMENT '披风槽位',
  `outfit_item` VARCHAR(40)    NULL COMMENT '外袍 / 甲胄槽位',
  `hat_item`   VARCHAR(40)     NULL COMMENT '冠饰槽位',
  `updated_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `pet_id`),
  CONSTRAINT `fk_load_pet` FOREIGN KEY (`pet_id`) REFERENCES `quest_pets` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户萌宠穿搭（按槽位存 item_id）';

CREATE TABLE IF NOT EXISTS `quest_user_active_pet` (
  `user_id`    VARCHAR(40) NOT NULL,
  `pet_id`     VARCHAR(40) NOT NULL COMMENT '当前同行的萌宠',
  `updated_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_active_pet` FOREIGN KEY (`pet_id`) REFERENCES `quest_pets` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户当前同行萌宠';

-- --------------------------------------------------------------------------
-- 8. 用户偏好与开关
--    对应 questApi.getPrefs / updatePrefs
--    「非强迫原则」的落点全在这张表：总开关、提醒开关、频率、安静时段、
--    已静音的类别与模板（用户点过「不感兴趣」的记录，可撤销）。
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `quest_user_prefs` (
  `user_id`                  VARCHAR(40) NOT NULL,
  `feature_enabled`          TINYINT(1)  NOT NULL DEFAULT 1 COMMENT '灰度总开关',
  `remind_enabled`           TINYINT(1)  NOT NULL DEFAULT 1 COMMENT '提醒开关',
  `max_per_day`              INT         NOT NULL DEFAULT 2 COMMENT '每日最多提醒次数',
  `cooldown_min`             INT         NOT NULL DEFAULT 45 COMMENT '两次提醒最小间隔（分钟）',
  `quiet_start_hour`         INT         NOT NULL DEFAULT 22 COMMENT '安静时段起',
  `quiet_end_hour`           INT         NOT NULL DEFAULT 8  COMMENT '安静时段止',
  `max_surfaces_per_template` INT        NOT NULL DEFAULT 3 COMMENT '同模板最多出现次数',
  `allow_location`           TINYINT(1)  NOT NULL DEFAULT 1,
  `show_safety_tip`          TINYINT(1)  NOT NULL DEFAULT 1,
  `muted_categories`         JSON            NULL COMMENT '整类静音的 category 数组',
  `muted_templates`          JSON            NULL COMMENT '单条静音的模板 ID 数组',
  `surface_counts`           JSON            NULL COMMENT '各模板已出现次数',
  `last_surfaced_at`         DATETIME        NULL,
  `updated_at`               DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务提醒偏好与开关';

-- --------------------------------------------------------------------------
-- 9. 埋点事件（本地演示版存在 localStorage，见 docs/quest/EVENTS.md）
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `quest_events` (
  `id`         BIGINT      NOT NULL AUTO_INCREMENT,
  `user_id`    VARCHAR(40)     NULL,
  `event`      VARCHAR(40) NOT NULL,
  `payload`    JSON            NULL,
  `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_event` (`event`, `created_at`),
  KEY `idx_event_user` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务功能埋点事件';

-- ==========================================================================
-- 初始化数据（可选）
-- --------------------------------------------------------------------------
-- 任务模板、萌宠、装扮三张配置表的初始数据与前端
-- src/data/questConfig.js、src/data/pets.js 完全一致。
-- 演示版不写库；接入后端时由后台导入或由种子脚本写入，这里不重复维护，
-- 避免两份数据漂移。后台只需保证字段名与本脚本一致即可。
-- ==========================================================================

-- ==========================================================================
-- 回滚（仅在需要彻底撤销本功能时执行）
-- --------------------------------------------------------------------------
-- DROP TABLE IF EXISTS `quest_events`;
-- DROP TABLE IF EXISTS `quest_user_prefs`;
-- DROP TABLE IF EXISTS `quest_user_active_pet`;
-- DROP TABLE IF EXISTS `quest_user_loadouts`;
-- DROP TABLE IF EXISTS `quest_user_pet_items`;
-- DROP TABLE IF EXISTS `quest_user_pets`;
-- DROP TABLE IF EXISTS `quest_pet_items`;
-- DROP TABLE IF EXISTS `quest_pets`;
-- DROP TABLE IF EXISTS `quest_coin_ledger`;
-- DROP TABLE IF EXISTS `quest_task_records`;
-- DROP TABLE IF EXISTS `quest_task_templates`;
-- DROP TABLE IF EXISTS `quest_pre_items`;
--
-- 说明：本脚本没有对任何既有表执行 ALTER，因此回滚只需删除以上新表，
--       既有用户、景点、帖子、行程数据不受影响。
-- ==========================================================================
