
const redis = require('redis');
const util = require('util');
const mongoose = require('mongoose');

// Set redis client
const redisClient = redis.createClient('redis://192.168.1.110:6379');

// Promisify redis client get and set function
redisClient.get = util.promisify(redisClient.get);
redisClient.set = util.promisify(redisClient.set);

// Copy the exec prototype
const exec = mongoose.Query.prototype.exec;

// Use the cache
mongoose.Query.prototype.cache = function () {

    this.useCache = true;

    // Return this to allow chain (ex: .cache().limit(10).blabla)
    return this;
}

// Override the exec function
mongoose.Query.prototype.exec = async function () {

    // if cache is disabled we return the value from the BDD
    if (!this.useCache) {
        return exec.apply(this);
    }

    // Concat the Query and the collection name
    const keys = JSON.stringify(Object.assign({}, this.getQuery(), {
        collection: this.mongooseCollection.name
    }));

    // Second method to assign 
    // const keys2 = { ...this.getQuery(), ...{ collection: this.mongooseCollection.name } }

    // Check if Key exists in cache
    const resultCached = await redisClient.get(keys);
    if (resultCached) {
        const doc = JSON.parse(resultCached);
        return Array.isArray(doc) ? doc.map(v => this.model(v)) : new this.model(doc);
    }

    // Search for the value
    const result = await exec.apply(this);

    // Save the result in redis
    await redisClient.set(keys, JSON.stringify(result))

    return result;
}