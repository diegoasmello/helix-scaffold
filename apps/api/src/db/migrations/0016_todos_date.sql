-- `todos.date` is a calendar day, not an instant. Its values are UTC
-- midnights (the API turned `YYYY-MM-DD` into `new Date(...)`), stored as UTC
-- wall times, so the cast keeps their day. Hand-edited: `USING` made explicit.
ALTER TABLE "todos" ALTER COLUMN "date" SET DATA TYPE date USING "date"::date;
