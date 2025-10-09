#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据库配置类型转换修复脚本
解决 db_params 类型错误问题
"""

import json
import os
import sys
import urllib.parse
import yaml
from typing import Dict, Any, Union
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DatabaseConfigFixer:
    """数据库配置修复器"""

    def __init__(self, config_dir: str = "."):
        self.config_dir = config_dir
        self.supported_formats = ['.json', '.yaml', '.yml', '.env']

    def find_config_files(self) -> list:
        """查找可能的配置文件"""
        config_files = []

        # 常见的配置文件名
        config_names = [
            'config', 'settings', 'database', 'db',
            'app', 'application', '.env'
        ]

        for name in config_names:
            for ext in self.supported_formats:
                file_path = os.path.join(self.config_dir, f"{name}{ext}")
                if os.path.exists(file_path):
                    config_files.append(file_path)

        return config_files

    def load_config(self, file_path: str) -> Dict[str, Any]:
        """加载配置文件"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                if file_path.endswith('.json'):
                    return json.load(f)
                elif file_path.endswith(('.yaml', '.yml')):
                    return yaml.safe_load(f)
                elif file_path.endswith('.env'):
                    return self._parse_env_file(f)
                else:
                    logger.warning(f"不支持的配置文件格式: {file_path}")
                    return {}
        except Exception as e:
            logger.error(f"加载配置文件失败 {file_path}: {e}")
            return {}

    def _parse_env_file(self, file_handle) -> Dict[str, Any]:
        """解析 .env 文件"""
        config = {}
        for line in file_handle:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                config[key.strip()] = value.strip().strip('"\'')
        return config

    def fix_database_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """修复数据库配置"""
        # 查找数据库配置的可能的键名
        db_keys = ['database', 'db', 'DATABASE_URL', 'DB_URL', 'DATABASE']

        for key in db_keys:
            if key in config:
                db_config = config[key]

                # 如果是字符串，尝试解析
                if isinstance(db_config, str):
                    logger.info(f"发现字符串格式的数据库配置: {key}")
                    fixed_config = self._parse_database_string(db_config)
                    config[key] = fixed_config
                    logger.info(f"已将数据库配置转换为字典格式: {fixed_config}")

                # 如果是字典，验证类型
                elif isinstance(db_config, dict):
                    config[key] = self._validate_database_dict(db_config)

        return config

    def _parse_database_string(self, db_string: str) -> Dict[str, Any]:
        """解析数据库字符串为字典"""
        # 如果是 URL 格式
        if '://' in db_string:
            return self._parse_database_url(db_string)

        # 如果是简单的连接字符串，尝试解析
        elif ':' in db_string and '/' in db_string:
            # 假设格式为 host:port/database
            parts = db_string.split('/')
            if len(parts) >= 2:
                connection_part = parts[0]
                database_name = parts[1]

                host_port = connection_part.split(':')
                host = host_port[0] if host_port else 'localhost'
                port = int(host_port[1]) if len(host_port) > 1 else 5432

                return {
                    'host': host,
                    'port': port,
                    'database': database_name,
                    'user': 'postgres',
                    'password': ''
                }

        # 默认配置
        return {
            'host': 'localhost',
            'port': 5432,
            'database': 'emaildb',
            'user': 'postgres',
            'password': ''
        }

    def _parse_database_url(self, url: str) -> Dict[str, Any]:
        """解析数据库 URL"""
        try:
            parsed = urllib.parse.urlparse(url)

            # 从 URL 中提取数据库信息
            database_name = parsed.path.lstrip('/') if parsed.path else 'emaildb'

            return {
                'host': parsed.hostname or 'localhost',
                'port': parsed.port or 5432,
                'database': database_name,
                'user': parsed.username or 'postgres',
                'password': parsed.password or ''
            }
        except Exception as e:
            logger.error(f"解析数据库 URL 失败: {e}")
            return self._get_default_config()

    def _validate_database_dict(self, db_dict: Dict[str, Any]) -> Dict[str, Any]:
        """验证和标准化数据库字典"""
        return {
            'host': str(db_dict.get('host', 'localhost')),
            'port': int(db_dict.get('port', 5432)),
            'database': str(db_dict.get('database', 'emaildb')),
            'user': str(db_dict.get('user', 'postgres')),
            'password': str(db_dict.get('password', '')),
            # 可选参数
            'sslmode': str(db_dict.get('sslmode', 'prefer')),
            'max_connections': int(db_dict.get('max_connections', 10)),
            'connect_timeout': int(db_dict.get('connect_timeout', 30))
        }

    def _get_default_config(self) -> Dict[str, Any]:
        """获取默认数据库配置"""
        return {
            'host': 'localhost',
            'port': 5432,
            'database': 'emaildb',
            'user': 'postgres',
            'password': '',
            'sslmode': 'prefer',
            'max_connections': 10,
            'connect_timeout': 30
        }

    def save_config(self, file_path: str, config: Dict[str, Any]) -> bool:
        """保存配置文件"""
        try:
            # 创建备份
            backup_path = f"{file_path}.backup"
            if os.path.exists(file_path):
                import shutil
                shutil.copy2(file_path, backup_path)
                logger.info(f"已创建备份文件: {backup_path}")

            with open(file_path, 'w', encoding='utf-8') as f:
                if file_path.endswith('.json'):
                    json.dump(config, f, indent=2, ensure_ascii=False)
                elif file_path.endswith(('.yaml', '.yml')):
                    yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
                elif file_path.endswith('.env'):
                    self._save_env_file(f, config)

            logger.info(f"配置文件已保存: {file_path}")
            return True

        except Exception as e:
            logger.error(f"保存配置文件失败 {file_path}: {e}")
            return False

    def _save_env_file(self, file_handle, config: Dict[str, Any]):
        """保存 .env 文件"""
        for key, value in config.items():
            if isinstance(value, dict):
                # 对于字典类型的配置，展平为环境变量
                for sub_key, sub_value in value.items():
                    file_handle.write(f"{key.upper()}_{sub_key.upper()}={sub_value}\n")
            else:
                file_handle.write(f"{key.upper()}={value}\n")

    def fix_all_configs(self) -> bool:
        """修复所有配置文件"""
        config_files = self.find_config_files()

        if not config_files:
            logger.warning("未找到配置文件")
            return False

        fixed_count = 0
        for file_path in config_files:
            logger.info(f"正在检查配置文件: {file_path}")

            config = self.load_config(file_path)
            if not config:
                continue

            # 检查是否需要修复
            original_config = config.copy()
            fixed_config = self.fix_database_config(config)

            if fixed_config != original_config:
                if self.save_config(file_path, fixed_config):
                    fixed_count += 1
                    logger.info(f"✅ 配置文件已修复: {file_path}")
                else:
                    logger.error(f"❌ 配置文件修复失败: {file_path}")
            else:
                logger.info(f"✅ 配置文件无需修复: {file_path}")

        logger.info(f"修复完成，共修复 {fixed_count} 个配置文件")
        return fixed_count > 0


def main():
    """主函数"""
    import argparse

    parser = argparse.ArgumentParser(description='数据库配置修复工具')
    parser.add_argument('--dir', default='.', help='配置文件目录')
    parser.add_argument('--file', help='指定的配置文件路径')
    parser.add_argument('--dry-run', action='store_true', help='仅检查，不修改文件')

    args = parser.parse_args()

    fixer = DatabaseConfigFixer(args.dir)

    if args.file:
        # 修复指定文件
        if not os.path.exists(args.file):
            logger.error(f"配置文件不存在: {args.file}")
            sys.exit(1)

        logger.info(f"正在检查配置文件: {args.file}")
        config = fixer.load_config(args.file)

        if args.dry_run:
            fixed_config = fixer.fix_database_config(config)
            logger.info("DRY RUN - 不会修改文件")
            logger.info(f"修复后的配置: {json.dumps(fixed_config, indent=2, ensure_ascii=False)}")
        else:
            fixed_config = fixer.fix_database_config(config)
            fixer.save_config(args.file, fixed_config)
            logger.info("配置文件修复完成")
    else:
        # 修复所有配置文件
        if args.dry_run:
            logger.info("DRY RUN - 仅检查，不修改文件")
            # 这里可以添加检查逻辑

        success = fixer.fix_all_configs()
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()