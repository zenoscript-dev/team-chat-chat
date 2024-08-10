import { Injectable } from '@nestjs/common';
import { Client } from 'cassandra-driver';

@Injectable()
export class CassandraConfigService {
  private client: Client;

  constructor() {
    this.client = new Client({
      contactPoints: [process.env.CASSANDRA_HOST],
      localDataCenter: process.env.CASSANDRA_DATACENTER,
      keyspace: process.env.CASSANDRA_KEYSPACE,
    });

    this.connect();
  }

  async connect() {
    try {
      await this.client.connect();
      console.log('Connected to Cassandra');
    } catch (error) {
      console.error('Failed to connect to Cassandra', error);
    }
  }

  getClient(): Client {
    return this.client;
  }
}
