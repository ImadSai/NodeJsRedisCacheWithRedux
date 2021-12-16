
const redis = require('redis');
const util = require('util');
const redisClient = redis.createClient('redis://192.168.1.110:6379');
const mongoose = require('mongoose');

// Promisify redis client get and set function
redisClient.get = util.promisify(redisClient.get);
redisClient.set = util.promisify(redisClient.set);

// Copy the exec prototype
const exec = mongoose.Query.prototype.exec;

// Override the exec function
mongoose.Query.prototype.exec = async function () {

    console.log('------------------')

    // Concat the Query and the collection name
    const keys = JSON.stringify(Object.assign({}, this.getQuery(), {
        collection: this.mongooseCollection.name
    }));

    // Second method to assign 
    // const keys2 = { ...this.getQuery(), ...{ collection: this.mongooseCollection.name } }

    console.log(keys);

    // Check if Key exists in cache
    const resultCached = await redisClient.get(keys);
    if (resultCached) {
        console.log('-- Value found in Redis')
        const doc = JSON.parse(resultCached);
        return Array.isArray(doc) ? doc.map(v => this.model(v)) : new this.model(doc);
    }

    // Search for the value
    console.log('- Search for the result in BDD');
    const result = await exec.apply(this, arguments);

    // Save the result in redis
    await redisClient.set(keys, JSON.stringify(result))

    return result;
}