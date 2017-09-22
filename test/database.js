const { expect } = require('chai');
const dropMongoDbCollections = require('drop-mongodb-collections');
const mongoist = require('../');
const mongojs = require('mongojs');

const connectionString = 'mongodb://localhost/test';

describe('database', function() {
  this.timeout(5000);

  let db;

  beforeEach(dropMongoDbCollections(connectionString));
  beforeEach(async() => {
    db = mongoist(connectionString);

    await db.a.insert([{ 
      name: 'Squirtle',type: 'water', level: 10, }, {
      name: 'Starmie', type: 'water', level: 8, }, {
      name: 'Charmander', type: 'fire', level: 8,}, {
      name: 'Lapras', type: 'water', level: 12,}
    ]);
  });

  it('should return a collection if accessing a non defined property', async() => {
    expect(db.xyz).to.exist;
  });

  it('should accept connection strings without mongodb:// protocol specified', async() => {
    const dbShort = mongoist('localhost/test');
    const docs = await dbShort.a.find();

    expect(docs).to.have.length(4);
  });

  it('should accept connection strings without host and mongodb:// protocol specified', async() => {
    const dbShort = mongoist('test');
    const docs = await dbShort.a.find();

    expect(docs).to.have.length(4);
  });

  it('should create a collection', async() => {
    const collection = await db.createCollection('test123');

    expect(collection).to.exist;

    try {
      await db.createCollection('test123');
    } catch (e) {
      return;
    }

    throw new Error('Collection with duplicate collection name created a second time and an error was expected!');
  });

  it('should list collections', async() => {
    await db.createCollection('test1');
    await db.createCollection('test2');

    const collections = await db.listCollections();

    expect(collections).to.have.length(3);
  });

  it('should get collection names', async() => {
    await db.createCollection('test1');
    await db.createCollection('test2');

    const collectionNames = await db.getCollectionNames();

    expect(collectionNames).to.have.length(3);
    expect(collectionNames).to.include('test1');
    expect(collectionNames).to.include('test2');
    expect(collectionNames).to.include('a');
  });

  it('should get db stats', async() => {
    const stats = await db.stats();

    expect(stats.ok).to.equal(1);
    expect(stats.collections).to.exist;
    expect(stats.indexes).to.exist;
  });

  it('should emit an error event if a connection could not be established', async() => {
    const cannotConnect = mongoist('mongodb://127.0.0.1:65535/testdb');

    let errorEvent = null;
    cannotConnect.on('error', (error) => {
      errorEvent = error;
    });

    try {
      await cannotConnect.xyz.find();
    } catch (e) {
      expect(errorEvent).to.exist;

      return;
    }

    throw new Error('Expected error to be thrown');
  });

  it('should emit an event if database connection opened', async() => {
    const db = mongoist(connectionString);

    const events = {};

    db.on('connect', () => events.connect = true);

    await db.xyz.find();

    expect(events).to.deep.equal({ connect: true });

    await db.close();
  });

  describe('users', function() {
    beforeEach(async () => await db.dropAllUsers());

    it('should create a user', async() => {
      const user = await db.createUser({
        user: 'mongoist',
        pwd: 'topsecret',
        customData: { department: 'area51' },
        roles: ['readWrite']
      });
  
      expect(user).to.exist;
    });
  
    it('should not create duplicate users', async() => {
      const user = await db.createUser({
        user: 'mongoist',
        pwd: 'topsecret',
        customData: { department: 'area51' },
        roles: ['readWrite']
      });
  
      expect(user).to.exist;

      try {
        await db.createUser({
          user: 'mongoist',
          pwd: 'topsecret',
          customData: { department: 'area51' },
          roles: ['readWrite']
        });
      } catch(e) {
        expect(e.code).to.equal(11000);
        return;
      }
    
      throw new Error('Duplicate users should not be created');
    });
  
    it('should drop a user', async() => {
      const user = await db.createUser({
        user: 'mongoist',
        pwd: 'topsecret',
        customData: { department: 'area51' },
        roles: ['readWrite']
      });
  
      expect(user).to.exist;
    
      const result = await db.dropUser('mongoist');

      expect(result.ok).to.exist;
    });
  });

  it('should get a non existing last error', async () => {
    const lastError = await db.getLastError();
    expect(lastError).to.not.exist;
  });

  it('should get the last error obj with non existing error field', async () => {
    const lastError = await db.getLastErrorObj();

    expect(lastError).to.exist;
    expect(lastError.err).to.not.exist;
  });

  it('should run a named command', async () => {
    const stats = await db.runCommand('dbStats');
    expect(stats.ok).to.equal(1);
  });

  
  it('should allow passing in a mongojs connection', async() => {
    const mongojsDb = mongojs(connectionString);
    const db = mongoist(mongojsDb);

    const docs = await db.a.find({});

    expect(docs).to.have.length(4);
  });

  it('should drop a database passing in a mongojs connection', async() => {
    const dbConnectionString = 'mongodb://localhost/test2';
    const db = mongoist(dbConnectionString);
    
    await db.b.insert({ name: 'Squirtle',type: 'water', level: 10, });
    const docs = await db.b.find({});
    expect(docs).to.have.length(1);

    await db.dropDatabase();

    const db2 = mongoist(dbConnectionString);
    const docs2 = await db2.b.find({});
    expect(docs2).to.have.length(0);
  });
});