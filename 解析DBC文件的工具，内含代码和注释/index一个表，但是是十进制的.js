const pool = require('./db-connection');
const path = require('path');

// 清空缓存确保重新加载
delete require.cache[require.resolve('./parser')];
const parser = require('./parser');

// 新增合并存储逻辑
async function saveCombinedToDatabase(messages) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 创建合并表（如果不存在）
    await connection.query(`
      CREATE TABLE IF NOT EXISTS can_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        is_message BOOLEAN NOT NULL,       -- 标记是报文还是信号
        message_id INT,                    -- 所属报文ID
        message_name VARCHAR(255),         -- 报文名称
        signal_name VARCHAR(255),          -- 信号名称（仅信号有）
        dlc INT,                          -- 报文数据长度
        node VARCHAR(100),                 -- 发送节点
        start_bit INT,                     -- 信号起始位
        bit_length INT,                    -- 信号位长
        factor FLOAT,                     -- 缩放因子
        offset FLOAT,                      -- 偏移量
        min_value FLOAT,                  -- 最小值
        max_value FLOAT,                   -- 最大值
        unit VARCHAR(50),                 -- 单位
        comment TEXT,                      -- 注释
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 清空旧数据（可选）
    await connection.query('TRUNCATE TABLE can_data');

    // 存储数据
    for (const message of messages) {
      // 插入报文记录
      await connection.query(
        `INSERT INTO can_data (
          is_message, message_id, message_name, 
          dlc, node, comment
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          true,           // is_message = true
          message.id,
          message.name,
          message.dlc || 8,
          message.node || '',
          message.comment || ''
        ]
      );

      // 插入信号记录
      for (const signal of message.signals) {
        await connection.query(
          `INSERT INTO can_data (
            is_message, message_id, message_name,
            signal_name, start_bit, bit_length,
            factor, offset, min_value, max_value,
            unit, comment
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            false,          // is_message = false
            message.id,
            message.name,
            signal.name,
            signal.startBit,
            signal.bitLength,
            signal.factor || 1,
            signal.offset || 0,
            signal.min,
            signal.max,
            signal.unit || '',
            signal.comment || ''
          ]
        );
      }
    }

    await connection.commit();
    console.log(`✅ 成功存储 ${messages.length} 条报文和 ${messages.reduce((a,b) => a + b.signals.length, 0)} 个信号到合并表`);
  } catch (error) {
    await connection?.rollback();
    console.error('存储失败:', error.message);
    throw error;
  } finally {
    connection?.release();
  }
}

async function main() {
  try {
    console.log("✅ 程序启动");

    // 1. 解析文件路径
    const dbcPath = path.resolve('./example.dbc');
    console.log("🔍 解析文件绝对路径:", dbcPath);

    // 2. 解析DBC文件
    console.log("📄 开始解析DBC文件...");
    const dbcData = await parser.parseDBC(dbcPath);
    console.log("📊 解析结果:", {
      报文数量: dbcData.messages.length,
      信号总数: dbcData.messages.reduce((sum, msg) => sum + msg.signals.length, 0)
    });

    // 3. 存储到合并表
    console.log("💾 开始存储到合并表...");
    await saveCombinedToDatabase(dbcData.messages);
    console.log("🎉 数据存储完成");

  } catch (error) {
    console.error('🔥 发生错误:', error);
  } finally {
    await pool.end();
    console.log("🛑 数据库连接池已关闭");
  }
}

main();