import type { ColumnType } from "kysely"

export type Timestamp = ColumnType<Date, Date | string, Date | string>
export type GeneratedTimestamp = ColumnType<
  Date,
  Date | string | undefined,
  Date | string
>
export type CalendarDate = ColumnType<
  Date | string,
  Date | string,
  Date | string
>
