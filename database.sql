PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

CREATE TABLE user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(128)
);

CREATE TABLE challenge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(50) NOT NULL,
  price_dh FLOAT NOT NULL,
  initial_balance FLOAT NOT NULL,
  profit_target_pct FLOAT DEFAULT 10.0,
  max_daily_loss_pct FLOAT DEFAULT 5.0,
  max_total_loss_pct FLOAT DEFAULT 10.0
);

CREATE TABLE account (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  balance FLOAT DEFAULT 5000.0,
  equity FLOAT DEFAULT 5000.0,
  initial_balance FLOAT DEFAULT 5000.0,
  daily_starting_equity FLOAT DEFAULT 5000.0,
  status VARCHAR(20) DEFAULT 'active',
  challenge_type VARCHAR(50),
  created_at DATETIME,
  FOREIGN KEY(user_id) REFERENCES user(id)
);

CREATE TABLE trade (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  asset VARCHAR(20) NOT NULL,
  type VARCHAR(10) NOT NULL,
  entry_price FLOAT NOT NULL,
  exit_price FLOAT,
  quantity FLOAT NOT NULL,
  profit FLOAT DEFAULT 0.0,
  status VARCHAR(20) DEFAULT 'open',
  timestamp DATETIME,
  FOREIGN KEY(account_id) REFERENCES account(id)
);

CREATE TABLE position (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  asset VARCHAR(20) NOT NULL,
  quantity FLOAT NOT NULL DEFAULT 0.0,
  avg_entry_price FLOAT NOT NULL DEFAULT 0.0,
  created_at DATETIME,
  updated_at DATETIME,
  FOREIGN KEY(account_id) REFERENCES account(id)
);

CREATE TABLE user_challenge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  challenge_id INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  payment_method VARCHAR(20) NOT NULL,
  created_at DATETIME,
  FOREIGN KEY(user_id) REFERENCES user(id),
  FOREIGN KEY(challenge_id) REFERENCES challenge(id)
);

CREATE TABLE pay_pal_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id VARCHAR(255) NOT NULL,
  client_secret VARCHAR(255) NOT NULL,
  mode VARCHAR(20) DEFAULT 'sandbox',
  currency_code VARCHAR(10) DEFAULT 'USD',
  created_at DATETIME
);

CREATE TABLE admin_action_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action VARCHAR(50) NOT NULL,
  details VARCHAR(255),
  created_at DATETIME
);

COMMIT;
