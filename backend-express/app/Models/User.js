'use strict';

const { Model } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
    class User extends Model {
        static ROLE_ADMIN = 'admin';
        static ROLE_MEMBER = 'member';
        /** @deprecated use ROLE_MEMBER */
        static ROLE_DRIVER = 'member';

        static USER_CODE = 'user_code';
        static USER_NAME = 'user_name';
        static PASSWORD = 'password';
        static ROLE = 'role';
        static JWT_ACTIVE = 'jwt_active';
        static STATUS = 'status';
    }

    User.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true
            },
            user_code: {
                type: DataTypes.STRING(15),
                allowNull: false,
                unique: true
            },
            user_name: {
                type: DataTypes.STRING(20),
                allowNull: false
            },
            password: {
                type: DataTypes.STRING(255),
                allowNull: false
            },
            role: {
                type: DataTypes.STRING(255),
                allowNull: false
            },
            jwt_active: {
                type: DataTypes.STRING(255),
                allowNull: true
            },
            remember_token: {
                type: DataTypes.STRING(255),
                allowNull: true
            },
            status: {
                type: DataTypes.INTEGER,
                allowNull: true
            }
        },
        {
            sequelize,
            modelName: 'User',
            tableName: 'users',
            timestamps: true,
            underscored: true,
            paranoid: true,
            deletedAt: 'deleted_at',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            hooks: {
                beforeCreate: async (user) => {
                    if (user.password) {
                        user.password = await bcrypt.hash(user.password, 10);
                    }
                },
                beforeUpdate: async (user) => {
                    if (user.changed('password')) {
                        user.password = await bcrypt.hash(user.password, 10);
                    }
                }
            }
        }
    );

    User.associate = () => {};

    return User;
};
