-- 驿程 vh0.2 / MySQL 8.0 增量迁移
-- 先执行 001_quest.sql。先备份数据库；本脚本不删除旧用户资产或旧任务流水。
-- 当前运行版仍为 localStorage 演示；本 SQL 是后端落库准备，尚未连接运行站点。
SET NAMES utf8mb4;

ALTER TABLE quest_pets MODIFY COLUMN unlock_cost INT NULL DEFAULT NULL COMMENT 'vh0.2 宠物不可金币解锁；旧记录保留';
ALTER TABLE quest_pet_items MODIFY COLUMN price INT NULL DEFAULT NULL COMMENT '仅通用金币服饰填写价格';
ALTER TABLE quest_pet_items ADD COLUMN acquisition VARCHAR(32) NOT NULL DEFAULT 'coin' COMMENT 'coin/core/activity/verified_attraction_task';
ALTER TABLE quest_pet_items ADD COLUMN attraction_id VARCHAR(40) NULL COMMENT '景点专属服饰所属景点';
ALTER TABLE quest_pet_items ADD COLUMN motif VARCHAR(40) NULL COMMENT '本地景点视觉主题';
ALTER TABLE quest_coin_ledger MODIFY COLUMN reason VARCHAR(32) NOT NULL COMMENT '任务收益或通用服饰购买；历史 unlock 记录保留';

UPDATE quest_pets SET unlock_cost = NULL, is_default = 0
WHERE id IN ('pet-qizai','pet-zhuhuan','pet-jinsihou','pet-lingniu');
UPDATE quest_pet_items SET price = NULL, acquisition = 'core'
WHERE id IN ('it-bamboo-back','it-cloud-back','it-vine-back','it-rock-back');
UPDATE quest_pet_items SET price = NULL, acquisition = 'activity'
WHERE id IN ('it-leaf-hat','it-feather-hat','it-vine-hat','it-rock-hat');

CREATE TABLE IF NOT EXISTS vh02_task_chain (
  id VARCHAR(40) PRIMARY KEY, version VARCHAR(16) NOT NULL DEFAULT 'vh0.2',
  pet_id VARCHAR(40) NOT NULL, title VARCHAR(80) NOT NULL,
  reward_costume_id VARCHAR(40) NOT NULL, min_visit_days INT NOT NULL DEFAULT 2,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  trigger_config JSON NULL, scope_config JSON NULL,
  starts_at DATETIME NULL, ends_at DATETIME NULL,
  UNIQUE KEY uk_chain_pet_version (version, pet_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vh02_task_definition (
  id VARCHAR(50) PRIMARY KEY, chain_id VARCHAR(40) NULL,
  attraction_id VARCHAR(40) NOT NULL, title VARCHAR(80) NOT NULL,
  description VARCHAR(240) NOT NULL, task_type VARCHAR(16) NOT NULL,
  sequence_no INT NULL, optional TINYINT(1) NOT NULL DEFAULT 1,
  skippable TINYINT(1) NOT NULL DEFAULT 1,
  coin_reward INT NOT NULL DEFAULT 0, costume_reward_id VARCHAR(40) NULL,
  trigger_config JSON NULL, verification_config JSON NULL,
  scope_config JSON NULL, status VARCHAR(16) NOT NULL DEFAULT 'draft',
  starts_at DATETIME NULL, ends_at DATETIME NULL,
  KEY idx_task_chain (chain_id, sequence_no), KEY idx_task_attraction (attraction_id, status),
  CONSTRAINT fk_vh02_task_chain FOREIGN KEY (chain_id) REFERENCES vh02_task_chain(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vh02_user_core_progress (
  user_id VARCHAR(40) NOT NULL, step_id VARCHAR(50) NOT NULL,
  chain_id VARCHAR(40) NOT NULL, status VARCHAR(16) NOT NULL,
  verify_method VARCHAR(20) NOT NULL, visit_day DATE NOT NULL,
  completed_at DATETIME NOT NULL, PRIMARY KEY (user_id, step_id),
  KEY idx_core_user_chain (user_id, chain_id, visit_day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vh02_user_scenic_stamp (
  user_id VARCHAR(40) NOT NULL, attraction_id VARCHAR(40) NOT NULL,
  source_task_id VARCHAR(80) NOT NULL, granted_at DATETIME NOT NULL,
  PRIMARY KEY (user_id, attraction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vh02_itinerary_task_record (
  user_id VARCHAR(40) NOT NULL, task_id VARCHAR(100) NOT NULL,
  attraction_id VARCHAR(40) NOT NULL, trip_day DATE NOT NULL,
  task_type VARCHAR(16) NOT NULL, verify_method VARCHAR(20) NOT NULL,
  photo_upload_consent TINYINT(1) NOT NULL DEFAULT 0,
  photo_visibility VARCHAR(16) NOT NULL DEFAULT 'private',
  completed_at DATETIME NOT NULL,
  PRIMARY KEY (user_id, task_id), KEY idx_trip_day (user_id, trip_day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vh02_custom_task (
  id VARCHAR(60) PRIMARY KEY, owner_user_id VARCHAR(40) NOT NULL,
  attraction_id VARCHAR(40) NOT NULL, title VARCHAR(80) NOT NULL,
  task_type VARCHAR(16) NOT NULL, visibility VARCHAR(16) NOT NULL DEFAULT 'private',
  review_status VARCHAR(20) NOT NULL DEFAULT 'private',
  rejection_reason VARCHAR(240) NULL,
  distinct_verified_completions INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL, reviewed_at DATETIME NULL,
  KEY idx_custom_public (visibility, review_status, attraction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vh02_custom_task_completion (
  task_id VARCHAR(60) NOT NULL, user_id VARCHAR(40) NOT NULL,
  verify_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  verify_method VARCHAR(20) NOT NULL, completed_at DATETIME NOT NULL,
  reward_amount INT NOT NULL DEFAULT 0,
  PRIMARY KEY (task_id, user_id), KEY idx_custom_day (user_id, completed_at),
  CONSTRAINT fk_custom_completion_task FOREIGN KEY (task_id) REFERENCES vh02_custom_task(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vh02_creator_milestone (
  task_id VARCHAR(60) NOT NULL, threshold_count INT NOT NULL,
  coin_amount INT NOT NULL, ledger_id BIGINT NULL, granted_at DATETIME NOT NULL,
  PRIMARY KEY (task_id, threshold_count),
  CONSTRAINT fk_creator_milestone_task FOREIGN KEY (task_id) REFERENCES vh02_custom_task(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vh02_official_task_config (
  id VARCHAR(40) PRIMARY KEY, version VARCHAR(16) NOT NULL DEFAULT 'vh0.2',
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  max_reminders_per_day INT NOT NULL DEFAULT 2,
  quiet_hours JSON NOT NULL, gray_scope JSON NULL,
  reward_rules JSON NOT NULL, trigger_rules JSON NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 不回填已有用户宠物，不撤回历史金币和装扮。线上开启前需完成服务端规则与权限校验。
