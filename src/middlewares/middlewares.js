import secret from "../config/secret_key.js";
import jwt from "jsonwebtoken";

const hasApiToken = (req, res, next) => {
	const token = req.header("x-auth-token");
	if (!token) {
		return res.status(403).send({
			status: 403,
			message: "Authentification required",
		});
	}
	next();
};

const isAdmin = (req, res, next) => {
	const token = req.header("x-auth-token");
	try {
		const decoded = jwt.verify(token, secret);
		if (decoded.role == "admin") {
			next();
		} else {
			return res.status(403).send({
				status: 403,
				message: "Not authorized",
			});
		}
	} catch (error) {
		console.log(error);
		return res.status(401).send({
			status: 401,
			message: "Token is not valid",
		});
	}
};

const isUser = (req, res, next) => {
	const token = req.header("x-auth-token");
	try {
		const decoded = jwt.verify(token, secret);
		if (decoded.role == "user") {
			next();
		} else {
			return res.status(403).send({
				status: 403,
				message: "User feature endpoint",
			});
		}
	} catch (error) {
		return res.status(401).send({
			status: 401,
			message: "Token is not valid",
		});
	}
};

export { hasApiToken, isAdmin, isUser };
