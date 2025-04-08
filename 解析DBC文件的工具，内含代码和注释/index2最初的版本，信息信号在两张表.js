const pool = require('./db-connection');
const path = require('path');

// 修复1：确保唯一导入
delete require.cache[require.resolve('./parser')];
const parser = require('./parser');

// 新增数据库存储逻辑
async function saveMessagesToDatabase(messages) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 存储报文
    for (const message of messages) {
      await connection.query(
        `INSERT INTO messages 
        (id, name, dlc, node, comment) 
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          name=VALUES(name),
          dlc=VALUES(dlc),
          node=VALUES(node),
          comment=VALUES(comment)`,
        [
          message.id,
          message.name,
          message.dlc || 8,  // 确保有默认值
          message.node || '',
          message.comment || ''
        ]
      );

      // 存储信号
      for (const signal of message.signals) {
        await connection.query(
          `INSERT INTO signals 
          (message_id, name, start_bit, bit_length, 
          byte_order, is_signed, factor, offset, 
          min_value, max_value, unit, comment) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            message.id,
            signal.name,
            signal.startBit,
            signal.bitLength,
            signal.byteOrder || 0,  // 默认Intel格式
            signal.isSigned ? 1 : 0,
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
    console.log(`✅ 成功存储 ${messages.length} 条报文和 ${messages.reduce((a,b) => a + b.signals.length, 0)} 个信号`);
  } catch (error) {
    await connection.rollback();
    console.error('存储失败:', error.message);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function main() {
  let connection;
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
      首个报文: dbcData.messages[0] ? `${dbcData.messages[0].name} (${dbcData.messages[0].signals.length}个信号)` : '无'
    });

    // 3. 存储到数据库
    console.log("💾 开始存储到数据库...");
    await saveMessagesToDatabase(dbcData.messages);
    console.log("🎉 数据存储完成");

  } catch (error) {
    console.error('🔥 发生错误:', error.message);
  } finally {
    if (connection) {
      await connection.release();
      console.log("🛑 数据库连接已释放");
    }
    await pool.end();
  }
}

main().catch(err => console.error('💥 全局捕获:', err));