"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
// TODO: fix no-param-reassign
/* eslint-disable no-param-reassign */
var graphql_1 = require("graphql");
var json_schema_1 = require("./json-schema");
var primitiveTypes = {
    string: graphql_1.GraphQLString,
    date: graphql_1.GraphQLString,
    integer: graphql_1.GraphQLInt,
    number: graphql_1.GraphQLFloat,
    boolean: graphql_1.GraphQLBoolean,
};
var jsonType = new graphql_1.GraphQLScalarType({
    name: 'JSON',
    serialize: function (value) {
        return value;
    },
});
function getPrimitiveType(format, type) {
    var primitiveTypeName = format === 'int64' ? 'string' : type;
    var primitiveType = primitiveTypes[primitiveTypeName];
    if (!primitiveType) {
        return primitiveTypes.string;
    }
    return primitiveType;
}
exports.jsonSchemaTypeToGraphQL = function (title, jsonSchema, propertyName, isInputType, gqlTypes, required) {
    var baseType = (function () {
        if (json_schema_1.isBodyType(jsonSchema)) {
            return exports.jsonSchemaTypeToGraphQL(title, jsonSchema.schema, propertyName, isInputType, gqlTypes, required);
        }
        if (json_schema_1.isObjectType(jsonSchema) || json_schema_1.isArrayType(jsonSchema)) {
            // eslint-disable-next-line no-use-before-define,@typescript-eslint/no-use-before-define
            return exports.createGraphQLType(jsonSchema, title + "_" + propertyName, isInputType, gqlTypes);
        }
        if (jsonSchema.type === 'file') {
            // eslint-disable-next-line no-use-before-define,@typescript-eslint/no-use-before-define
            return exports.createGraphQLType({
                type: 'object',
                required: [],
                properties: { unsupported: { type: 'string' } },
            }, title + "_" + propertyName, isInputType, gqlTypes);
        }
        if (jsonSchema.type) {
            return getPrimitiveType(jsonSchema.format, jsonSchema.type);
        }
        throw new Error("Don't know how to handle schema " + JSON.stringify(jsonSchema) + " without type and schema");
    })();
    return baseType;
};
var makeValidName = function (name) {
    return name.replace(/[^_0-9A-Za-z]/g, '_');
};
exports.getTypeFields = function (jsonSchema, title, isInputType, gqlTypes) {
    return function () {
        var properties = {};
        if (json_schema_1.isObjectType(jsonSchema)) {
            Object.keys(jsonSchema.properties).forEach(function (key) {
                properties[makeValidName(key)] = jsonSchema.properties[key];
            });
        }
        return Object.keys(properties).reduce(function (prev, propertyName) {
            var _a;
            var propertySchema = properties[propertyName];
            var type = exports.jsonSchemaTypeToGraphQL(title, propertySchema &&
                Object.keys(propertySchema).length !== 0 &&
                Object.keys(propertySchema).includes('type')
                ? propertySchema
                : { type: 'object', properties: {} }, propertyName, isInputType, gqlTypes, !!(json_schema_1.isObjectType(jsonSchema) &&
                jsonSchema.required &&
                jsonSchema.required.includes(propertyName)));
            return __assign({}, prev, (_a = {}, _a[propertyName] = {
                description: propertySchema.description,
                type: type,
            }, _a));
        }, {});
    };
};
exports.createGraphQLType = function (jsonSchema, title, isInputType, gqlTypes) {
    title = (jsonSchema && jsonSchema.title) || title;
    title = makeValidName(title);
    if (isInputType && !title.endsWith('Input')) {
        title += 'Input';
    }
    if (title in gqlTypes) {
        return gqlTypes[title];
    }
    if (!jsonSchema) {
        jsonSchema = {
            type: 'object',
            properties: {},
            required: [],
            description: '',
            title: title,
        };
    }
    else if (!jsonSchema.title) {
        jsonSchema = __assign({}, jsonSchema, { title: title });
    }
    if (json_schema_1.isArrayType(jsonSchema)) {
        var itemsSchema = Array.isArray(jsonSchema.items)
            ? jsonSchema.items[0]
            : jsonSchema.items;
        if (json_schema_1.isObjectType(itemsSchema) || json_schema_1.isArrayType(itemsSchema)) {
            return new graphql_1.GraphQLList(exports.createGraphQLType(itemsSchema, title + "_items", isInputType, gqlTypes));
        }
        if (itemsSchema.type === 'file') {
            // eslint-disable-next-line no-use-before-define,@typescript-eslint/no-use-before-define
            return new graphql_1.GraphQLList(exports.createGraphQLType({
                type: 'object',
                required: [],
                properties: { unsupported: { type: 'string' } },
            }, title, isInputType, gqlTypes));
        }
        var primitiveType = getPrimitiveType(itemsSchema.format, itemsSchema.type);
        return new graphql_1.GraphQLList(primitiveType);
    }
    if (json_schema_1.isObjectType(jsonSchema) &&
        !Object.keys(jsonSchema.properties || {}).length) {
        return jsonType;
    }
    var description = jsonSchema.description;
    var fields = exports.getTypeFields(jsonSchema, title, isInputType, gqlTypes);
    var result;
    if (isInputType) {
        result = new graphql_1.GraphQLInputObjectType({
            name: title,
            description: description,
            fields: fields,
        });
    }
    else {
        result = new graphql_1.GraphQLObjectType({
            name: title,
            description: description,
            fields: fields,
        });
    }
    gqlTypes[title] = result;
    return result;
};
exports.mapParametersToFields = function (parameters, typeName, gqlTypes) {
    return parameters.reduce(function (res, param) {
        var type = exports.jsonSchemaTypeToGraphQL("param_" + typeName, param.jsonSchema &&
            Object.keys(param.jsonSchema).length !== 0 &&
            Object.keys(param.jsonSchema).includes('type')
            ? param.jsonSchema
            : { type: 'object', properties: {} }, param.name, true, gqlTypes, param.required);
        res[param.name] = {
            type: type,
        };
        return res;
    }, {});
};
