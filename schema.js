import { integer, text, sqliteTable, real } from 'drizzle-orm/sqlite-core';

export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  deviceId: integer('device_id').notNull(),
  time: integer('time', { mode: 'timestamp' }).notNull(),
});

export const eventData = sqliteTable('event_data', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id),
  prePost: text('pre_post').notNull(),
  accX: real('acc_x').notNull(),
  accY: real('acc_y').notNull(),
  accZ: real('acc_z').notNull(),
  gyrX: real('gyr_x').notNull(),
  gyrY: real('gyr_y').notNull(),
  gyrZ: real('gyr_z').notNull(),
});
