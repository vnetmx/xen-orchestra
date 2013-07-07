var _ = require('underscore');
var Q = require('q');

//////////////////////////////////////////////////////////////////////

function deprecated(fn)
{
	return function (session, req) {
		console.warn(req.method +' is deprecated!');

		return fn.apply(this, arguments);
	};
}

//////////////////////////////////////////////////////////////////////

function Api(xo)
{
	this.xo = xo;
}

Api.prototype.exec = function (session, request, response) {
	var method = this.get(request.method);

	if (!method)
	{
		response.sendError(Api.err.INVALID_METHOD);
		return;
	}

	try
	{
		var result = method.call(this.xo, session, request, response); // @todo

		if (undefined === result)
		{
			/* jshint noempty:false */
		}
		else if (Q.isPromise(result))
		{
			result.then(
				function (result) {
					response.sendResult(result);
				},
				function (error) {
					response.sendError(error);
				}
			).done();
		}
		else
		{
			response.sendResult(result);
		}

	}
	catch (e)
	{
		response.sendError(e);
	}
};

Api.prototype.get = function (name) {
	/* jshint noempty: false */

	var parts = name.split('.');

	var current = Api.fn;
	for (
		var i = 0, n = parts.length;
		(i < n) && (current = current[parts[i]]);
		++i
	)
	{}

	// Method found.
	if (_.isFunction(current))
	{
		return current;
	}

	// It's a (deprecated) alias.
	if (_.isString(current))
	{
		return deprecated(this.get(current));
	}

	return undefined;
};

module.exports = function (xo) {
	return new Api(xo);
};

//////////////////////////////////////////////////////////////////////

function err(code, message)
{
	return {
		'code': code,
		'message': message
	};
}

Api.err = {

	//////////////////////////////////////////////////////////////////
	// JSON-RPC errors.
	//////////////////////////////////////////////////////////////////

	'INVALID_JSON': err(-32700, 'invalid JSON'),

	'INVALID_REQUEST': err(-32600, 'invalid JSON-RPC request'),

	'INVALID_METHOD': err(-32601, 'method not found'),

	'INVALID_PARAMS': err(-32602, 'invalid parameter(s)'),

	'SERVER_ERROR': err(-32603, 'unknown error from the server'),

	//////////////////////////////////////////////////////////////////
	// XO errors.
	//////////////////////////////////////////////////////////////////

	'NOT_IMPLEMENTED': err(0, 'not implemented'),

	'NO_SUCH_OBJECT': err(1, 'no such object'),

	// Not authenticated or not enough permissions.
	'UNAUTHORIZED': err(2, 'not authenticated or not enough permissions'),

	// Invalid email & passwords or token.
	'INVALID_CREDENTIAL': err(3, 'invalid credential'),

	'ALREADY_AUTHENTICATED': err(4, 'already authenticated'),
};

//////////////////////////////////////////////////////////////////////

Api.fn  = {};

Api.fn.api = {
	'getVersion' : function () {
		return '0.1';
	},
};

// Session management
Api.fn.session = {
	'signInWithPassword': function (session, req, res) {
		var p_email = req.params.email;
		var p_pass = req.params.password;

		if (!p_email || !p_pass)
		{
			throw Api.err.INVALID_PARAMS;
		}

		if (session.has('user_id'))
		{
			throw Api.err.ALREADY_AUTHENTICATED;
		}

		var user = this.users.findWhere({'email': p_email});
		if (!user)
		{
			throw Api.err.INVALID_CREDENTIAL;
		}

		user.checkPassword(p_pass).then(function (success) {
			if (!success)
			{
				res.sendError(Api.err.INVALID_CREDENTIAL);
				return;
			}

			res.sendResult(true);
		}).done();
	},

	'signInWithToken': function (session, req) {
		var p_token = req.params.token;

		if (!p_token)
		{
			throw Api.err.INVALID_PARAMS;
		}

		if (session.has('user_id'))
		{
			throw Api.err.ALREADY_AUTHENTICATED;
		}

		var token = this.tokens.get(p_token);
		if (!token)
		{
			throw Api.err.INVALID_CREDENTIAL;
		}

		// @todo How to disconnect when the token is deleted?
		//
		// @todo How to not leak the event callback when the
		// connection is closed?

		session.set('token_id', token.id);
		session.set('user_id', token.user_id);
		return true;
	},

	'getUser': deprecated(function (session) {
		var user_id = session.get('user_id');
		if (undefined === user_id)
		{
			return null;
		}

		return _.pick(this.users.get(user_id), 'id', 'email');
	}),

	'getUserId': function (session) {
		return session.get('user_id', null);
	},

	'createToken': 'token.create',

	'destroyToken': 'token.delete',
};

// User management.
Api.fn.user = {
	'create': function (session, req) {
		var p_email = req.params.email;
		var p_pass = req.params.password;
		var p_perm = req.params.permission;

		if (!p_email || !p_pass || !p_perm)
		{
			throw Api.err.INVALID_PARAMS;
		}

		return this.users.add({
			'email': p_email,
			'password': p_pass,
			'permission': p_perm,
		}).then(function (user) {
			return user.get('id');
		});
	},

	'delete': function () {
		throw Api.err.NOT_IMPLEMENTED;
	},

	'changePassword': function () {
		throw Api.err.NOT_IMPLEMENTED;
	},

	'getAll': function () {
		throw Api.err.NOT_IMPLEMENTED;
	},

	'set': function () {
		throw Api.err.NOT_IMPLEMENTED;
	},
};

// Token management.
Api.fn.token = {
	'create': function (session) {
		var user_id = session.get('user_id');
		/* jshint laxbreak: true */
		if ((undefined === user_id)
			|| session.has('token_id'))
		{
			throw Api.err.UNAUTHORIZED;
		}

		// @todo Token permission.

		// @todo Ugly.
		var token = this.tokens.model.generate(user_id);
		this.tokens.add(token);

		return token.id;
	},

	'delete': function (session, req) {
		var p_token = req.params.token;

		if (!this.tokens.get(p_token))
		{
			throw Api.err.INVALID_PARAMS;
		}

		this.tokens.remove(p_token);
		return true;
	},
};

// Pool management.
Api.fn.server = {
	'add': function (session, req, res) {
		var host = req.params.host; // @todo p_ prefixes.
		var username = req.params.username;
		var password = req.params.username;

		if (!host || !username || !password)
		{
			throw Api.err.INVALID_PARAMS;
		}

		var user_id = session.get('user_id');
		if (undefined === user_id)
		{
			throw Api.err.UNAUTHORIZED;
		}

		var user = this.users.get(user_id);
		if (!user.hasPermission('admin'))
		{
			throw Api.err.UNAUTHORIZED;
		}

		// @todo We are storing passwords which is bad!
		// Can we use tokens instead?
		this.servers.add({
			'host': host,
			'username': username,
			'password': password,
		}).then(function (server) {
			// @todo Connect the server.

			res.sendResult(''+ server.get('id'));
		}).done();
	},

	'remove': function (session, req, res) {
		var p_id = req.params.id;

		var user_id = session.get('user_id');
		if (undefined === user_id)
		{
			throw Api.err.UNAUTHORIZED;
		}

		var user = this.users.get(user_id);
		if (!user.hasPermission('admin'))
		{
			throw Api.err.UNAUTHORIZED;
		}

		if (!this.servers.exists(p_id))
		{
			throw Api.err.NO_SUCH_OBJECT;
		}

		// @todo Disconnect the server.

		this.servers.remove(p_id).then(function () {
			res.sendResult(true);
		}).done();
	},

	'connect': function () {

	},

	'disconnect': function () {

	},
};
