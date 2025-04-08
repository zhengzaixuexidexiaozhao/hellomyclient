const fs = require('fs').promises;

async function parseDBC(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return parseDBCManually(data);
  } catch (error) {
    throw new Error(`解析失败: ${error.message}`);
  }
}

function parseDBCManually(data) {
  const result = { messages: [], warnings: [], errors: [] };
  let currentMessage = null;

  const lines = data.split('\n');
  
  lines.forEach((line, index) => {
    try {
      line = line.trim();
      if (!line || line.startsWith('//')) return;

      // 解析报文定义 (BO_)
      if (line.startsWith('BO_')) {
        const parts = line.split(/\s+/).filter(p => p !== '');
        
        // 增强的错误处理
        if (parts.length < 5) {
          result.warnings.push(`第 ${index + 1} 行报文格式错误: ${line}`);
          return;
        }

        // 关键修正：正确定义 decimalId
        const decimalId = parseInt(parts[1]);
        if (isNaN(decimalId)) {
          result.errors.push(`第 ${index + 1} 行无效ID格式: ${parts[1]}`);
          return;
        }

        currentMessage = {
          id: `0x${decimalId.toString(16).toUpperCase()}`, // 16进制带前缀
          name: parts[2].replace(':', ''),
          dlc: parseInt(parts[4]) || 8,
          signals: [],
          comment: ''
        };
        result.messages.push(currentMessage);
      }

      // 解析信号定义 (SG_)
      else if (line.startsWith('SG_') && currentMessage) {
        const sigRegex = /SG_ ([\w ]+)\s*:\s*(\d+)\|(\d+)@([01])([+-])\s*\(([^,]+),([^)]+)\)\s*\[([^|]+)\|([^\]]+)\](?:\s+"([^"]*)")?/;
        const match = line.match(sigRegex);
        if (!match) {
          console.warn(`⚠️ 第 ${index + 1} 行信号格式错误: ${line}`);
          return;
        }

        currentMessage.signals.push({
          name: match[1].trim(),
          startBit: parseInt(match[2]),
          bitLength: parseInt(match[3]),
          byteOrder: parseInt(match[4]), // 0=Intel,1=Motorola
          isSigned: match[5] === '-',
          factor: parseFloat(match[6]) || 1,
          offset: parseFloat(match[7]) || 0,
          min: parseFloat(match[8]),
          max: parseFloat(match[9]),
          unit: (match[10] || '').trim(),
          comment: '' // 初始化comment字段
        });
      }

      // 新增：解析注释 (CM_)
      else if (line.startsWith('CM_ BO_') && currentMessage) {
        const commentMatch = line.match(/CM_ BO_ \d+ "(.*)"/);
        if (commentMatch) {
          currentMessage.comment = commentMatch[1];
        }
      }
      else if (line.startsWith('CM_ SG_') && currentMessage) {
        const commentMatch = line.match(/CM_ SG_ \d+ (\w+) "(.*)"/);
        if (commentMatch) {
          const signal = currentMessage.signals.find(s => s.name === commentMatch[1]);
          if (signal) {
            signal.comment = commentMatch[2];
          }
        }
      }

    } catch (err) {
      result.errors.push(`第 ${index + 1} 行解析崩溃: ${err.message}`);
    }
  });

  return result;
}

module.exports = {
  parseDBC,
  parseDBCManually
};