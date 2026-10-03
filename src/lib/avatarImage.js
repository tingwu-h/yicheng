export async function compressAvatar(file) {
  if (!file?.type.startsWith('image/')) throw new Error('请选择图片文件')
  if (file.size > 12 * 1024 * 1024) throw new Error('原图不能超过 12 MB')
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width * bitmap.height > 40000000) throw new Error('图片像素过高，请选择较小的图片')
    const side = Math.min(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = Math.min(512, side)
    const context = canvas.getContext('2d'); if (!context) throw new Error('无法压缩图片')
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, (bitmap.width-side)/2, (bitmap.height-side)/2, side, side, 0, 0, canvas.width, canvas.height)
    let blob
    for (const quality of [.86,.72,.58,.42]) {
      blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (!blob) throw new Error('压缩失败，请重试')
      if (blob.size <= 160 * 1024) break
    }
    const url = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('读取失败')); reader.readAsDataURL(blob) })
    return { url, originalBytes: file.size, bytes: blob.size, width: canvas.width }
  } finally { bitmap.close() }
}
