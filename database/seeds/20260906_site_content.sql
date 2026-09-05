USE shop;

START TRANSACTION;

INSERT INTO site_announcements
    (title, content, link_url, status, sort_order, starts_at, ends_at)
SELECT
    '新用户首单礼包',
    '注册成功后可获得新用户专属折扣，首单下单时可在结算页自动选择可用优惠。',
    '/products', 'ACTIVE', 10, NOW() - INTERVAL 1 DAY, NOW() + INTERVAL 30 DAY
WHERE NOT EXISTS (SELECT 1 FROM site_announcements WHERE title = '新用户首单礼包');

INSERT INTO site_announcements
    (title, content, link_url, status, sort_order, starts_at, ends_at)
SELECT
    '宠物用品满额免运费',
    '活动期间，符合条件的宠物食品与用品订单满 199 元即可享受免运费配送。',
    '/products', 'ACTIVE', 20, NOW() - INTERVAL 1 DAY, NOW() + INTERVAL 21 DAY
WHERE NOT EXISTS (SELECT 1 FROM site_announcements WHERE title = '宠物用品满额免运费');

INSERT INTO site_announcements
    (title, content, link_url, status, sort_order, starts_at, ends_at)
SELECT
    'PawPilot 智能喂食器上市',
    '支持定量喂食、余量提醒和移动端远程控制，适合多猫与小型犬家庭使用。',
    '/products/1', 'ACTIVE', 30, NOW() - INTERVAL 1 DAY, NOW() + INTERVAL 60 DAY
WHERE NOT EXISTS (SELECT 1 FROM site_announcements WHERE title = 'PawPilot 智能喂食器上市');

INSERT INTO site_announcements
    (title, content, link_url, status, sort_order, starts_at, ends_at)
SELECT
    '会员日服务提醒',
    '每月 8 日为会员日，登录后可领取优惠券并获得双倍积分，活动以订单完成时间为准。',
    NULL, 'ACTIVE', 40, NOW() - INTERVAL 1 DAY, NOW() + INTERVAL 90 DAY
WHERE NOT EXISTS (SELECT 1 FROM site_announcements WHERE title = '会员日服务提醒');

INSERT INTO user_addresses
    (user_id, recipient_name, phone, region, postal_code, detail_address, address, is_default)
SELECT u.id, '李思远', '+86 13800001111', '上海市 上海市 浦东新区', '200120',
       '世纪大道 100 号 12 层', '上海市 上海市 浦东新区 世纪大道 100 号 12 层', 1
FROM users u
WHERE u.username = 'cust1784501908143'
  AND NOT EXISTS (
      SELECT 1 FROM user_addresses a WHERE a.user_id = u.id AND a.is_default = 1
  );

INSERT INTO user_addresses
    (user_id, recipient_name, phone, region, postal_code, detail_address, address, is_default)
SELECT u.id, '王雨桐', '+86 13900002222', '广东省 深圳市 南山区', '518052',
       '科技园南区 8 栋 301', '广东省 深圳市 南山区 科技园南区 8 栋 301', 1
FROM users u
WHERE u.username = 'cust1784502233171'
  AND NOT EXISTS (
      SELECT 1 FROM user_addresses a WHERE a.user_id = u.id AND a.is_default = 1
  );

INSERT INTO product_questions
    (product_id, user_id, question, answer, answered_by, answered_at, created_at)
SELECT p.id, u.id,
       '这款喂食器可以使用 2.4G 和 5G 家用 Wi-Fi 吗？',
       '设备支持 2.4G Wi-Fi；如路由器为双频合一，建议在 App 中将设备网络固定到 2.4G。',
       admin.id, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 3 DAY
FROM products p
JOIN users u ON u.username = 'cust1784501908143'
JOIN users admin ON admin.username = 'admin1784502233171'
WHERE p.name = 'PawPilot Smart Pet Feeder 4L'
  AND NOT EXISTS (
      SELECT 1 FROM product_questions q
      WHERE q.product_id = p.id AND q.user_id = u.id
        AND q.question = '这款喂食器可以使用 2.4G 和 5G 家用 Wi-Fi 吗？'
  );

INSERT INTO product_questions
    (product_id, user_id, question, answer, answered_by, answered_at, created_at)
SELECT p.id, u.id,
       '饮水机滤芯建议多久更换一次？',
       '普通家庭建议 2 至 4 周更换一次；多宠家庭或水质较硬地区建议缩短到 2 周。',
       admin.id, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 2 DAY
FROM products p
JOIN users u ON u.username = 'cust1784502233171'
JOIN users admin ON admin.username = 'admin1784502233171'
WHERE p.name = 'HydraWhisk Quiet Cat Water Fountain'
  AND NOT EXISTS (
      SELECT 1 FROM product_questions q
      WHERE q.product_id = p.id AND q.user_id = u.id
        AND q.question = '饮水机滤芯建议多久更换一次？'
  );

INSERT INTO product_questions
    (product_id, user_id, question, answer, answered_by, answered_at, created_at)
SELECT p.id, u.id,
       '胸背带适合胸围 38 厘米的猫使用吗？',
       'M 码适配胸围约 33 到 41 厘米，建议同时测量颈围并在穿戴后保留一指空隙。',
       admin.id, NOW() - INTERVAL 12 HOUR, NOW() - INTERVAL 1 DAY
FROM products p
JOIN users u ON u.username = 'liveuser1784501794400'
JOIN users admin ON admin.username = 'admin1784502233171'
WHERE p.name = 'TrailTails Adjustable No-Pull Harness'
  AND NOT EXISTS (
      SELECT 1 FROM product_questions q
      WHERE q.product_id = p.id AND q.user_id = u.id
        AND q.question = '胸背带适合胸围 38 厘米的猫使用吗？'
  );

INSERT INTO reviews
    (user_id, product_id, rating, comment, status, created_at)
SELECT u.id, p.id, 5,
       '出粮很稳定，App 提示清楚，猫咪几天后就适应了定时喂食。',
       'APPROVED', NOW() - INTERVAL 2 DAY
FROM users u
JOIN products p ON p.name = 'PawPilot Smart Pet Feeder 4L'
WHERE u.username = 'cust1784501908143'
  AND NOT EXISTS (
      SELECT 1 FROM reviews r
      WHERE r.product_id = p.id AND r.user_id = u.id AND r.order_id IS NULL
  );

INSERT INTO reviews
    (user_id, product_id, rating, comment, status, created_at)
SELECT u.id, p.id, 4,
       '水流很轻，噪音比之前的小家电低，滤芯更换也很方便。',
       'APPROVED', NOW() - INTERVAL 1 DAY
FROM users u
JOIN products p ON p.name = 'HydraWhisk Quiet Cat Water Fountain'
WHERE u.username = 'pay1784501946'
  AND NOT EXISTS (
      SELECT 1 FROM reviews r
      WHERE r.product_id = p.id AND r.user_id = u.id AND r.order_id IS NULL
  );

INSERT INTO reviews
    (user_id, product_id, rating, comment, status, created_at)
SELECT u.id, p.id, 5,
       '胸背带受力均匀，狗狗不再往前冲，调节扣也很牢固。',
       'APPROVED', NOW() - INTERVAL 12 HOUR
FROM users u
JOIN products p ON p.name = 'TrailTails Adjustable No-Pull Harness'
WHERE u.username = 'cust1784502233171'
  AND NOT EXISTS (
      SELECT 1 FROM reviews r
      WHERE r.product_id = p.id AND r.user_id = u.id AND r.order_id IS NULL
  );

INSERT INTO support_sessions
    (user_id, assigned_admin_id, context_key, status, last_message, last_message_at)
SELECT u.id, admin.id, 'seed:delivery:user-3', 'OPEN',
       '您好，物流显示已到本地站点，预计今天 18:00 前完成派送。', NOW() - INTERVAL 45 MINUTE
FROM users u
JOIN users admin ON admin.username = 'admin1784502233171'
WHERE u.username = 'cust1784501908143'
  AND NOT EXISTS (
      SELECT 1 FROM support_sessions s WHERE s.context_key = 'seed:delivery:user-3'
  );

SET @support_session_delivery = (
    SELECT id FROM support_sessions WHERE context_key = 'seed:delivery:user-3' LIMIT 1
);

INSERT INTO support_messages
    (session_id, sender_id, sender_role, content, is_read_by_user, is_read_by_admin, created_at)
SELECT @support_session_delivery, u.id, 'USER',
       '我的喂食器订单显示已发货，请问今天能送到吗？', 1, 1, NOW() - INTERVAL 60 MINUTE
FROM users u
WHERE u.username = 'cust1784501908143'
  AND @support_session_delivery IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM support_messages m
      WHERE m.session_id = @support_session_delivery
        AND m.content = '我的喂食器订单显示已发货，请问今天能送到吗？'
  );

INSERT INTO support_messages
    (session_id, sender_id, sender_role, content, is_read_by_user, is_read_by_admin, created_at)
SELECT @support_session_delivery, admin.id, 'ADMIN',
       '您好，物流显示已到本地站点，预计今天 18:00 前完成派送。', 1, 1, NOW() - INTERVAL 45 MINUTE
FROM users admin
WHERE admin.username = 'admin1784502233171'
  AND @support_session_delivery IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM support_messages m
      WHERE m.session_id = @support_session_delivery
        AND m.content = '您好，物流显示已到本地站点，预计今天 18:00 前完成派送。'
  );

INSERT INTO support_sessions
    (user_id, assigned_admin_id, context_key, status, last_message, last_message_at)
SELECT u.id, admin.id, 'seed:return:user-5', 'OPEN',
       '支持签收后 7 天内申请售后，请保留商品外包装和配件。', NOW() - INTERVAL 20 MINUTE
FROM users u
JOIN users admin ON admin.username = 'admin1784502233171'
WHERE u.username = 'cust1784502233171'
  AND NOT EXISTS (
      SELECT 1 FROM support_sessions s WHERE s.context_key = 'seed:return:user-5'
  );

SET @support_session_return = (
    SELECT id FROM support_sessions WHERE context_key = 'seed:return:user-5' LIMIT 1
);

INSERT INTO support_messages
    (session_id, sender_id, sender_role, content, is_read_by_user, is_read_by_admin, created_at)
SELECT @support_session_return, u.id, 'USER',
       '宠物床尺寸不合适，想咨询退换货流程。', 1, 1, NOW() - INTERVAL 35 MINUTE
FROM users u
WHERE u.username = 'cust1784502233171'
  AND @support_session_return IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM support_messages m
      WHERE m.session_id = @support_session_return
        AND m.content = '宠物床尺寸不合适，想咨询退换货流程。'
  );

INSERT INTO support_messages
    (session_id, sender_id, sender_role, content, is_read_by_user, is_read_by_admin, created_at)
SELECT @support_session_return, admin.id, 'ADMIN',
       '支持签收后 7 天内申请售后，请保留商品外包装和配件。', 1, 1, NOW() - INTERVAL 20 MINUTE
FROM users admin
WHERE admin.username = 'admin1784502233171'
  AND @support_session_return IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM support_messages m
      WHERE m.session_id = @support_session_return
        AND m.content = '支持签收后 7 天内申请售后，请保留商品外包装和配件。'
  );

COMMIT;
