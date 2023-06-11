import Sequelize from "sequelize";
import config from "../config/config.js";

const { host, port, username, password, database, dialect } = config.connection;

const connection = new Sequelize(database, username, password, {
	host: host,
	port: port,
	dialect: dialect,
});

export default connection;
