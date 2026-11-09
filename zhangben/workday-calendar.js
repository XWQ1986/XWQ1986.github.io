(function exposeWorkdayCalendar(root, factory) {
  const calendar = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = calendar;
  if (root) root.XjWorkdayCalendar = calendar;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  // 国务院办公厅公布的中国大陆法定节假日安排；周末调休上班日仍按产品口径排除。
  const officialHolidayRanges = Object.freeze({
    2025: Object.freeze([
      ['2025-01-01', '2025-01-01'],
      ['2025-01-28', '2025-02-04'],
      ['2025-04-04', '2025-04-06'],
      ['2025-05-01', '2025-05-05'],
      ['2025-05-31', '2025-06-02'],
      ['2025-10-01', '2025-10-08'],
    ]),
    2026: Object.freeze([
      ['2026-01-01', '2026-01-03'],
      ['2026-02-15', '2026-02-23'],
      ['2026-04-04', '2026-04-06'],
      ['2026-05-01', '2026-05-05'],
      ['2026-06-19', '2026-06-21'],
      ['2026-09-25', '2026-09-27'],
      ['2026-10-01', '2026-10-07'],
    ]),
  });

  function parseDate(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDateKey(date) {
    return date.toISOString().slice(0, 10);
  }

  function addDays(value, days) {
    const date = value instanceof Date ? new Date(value.getTime()) : parseDate(value);
    if (!date) return '';
    date.setUTCDate(date.getUTCDate() + Number(days || 0));
    return formatDateKey(date);
  }

  function expandRange(start, end) {
    const values = [];
    const finish = parseDate(end);
    let cursor = parseDate(start);
    if (!cursor || !finish) return values;
    while (cursor <= finish) {
      values.push(formatDateKey(cursor));
      cursor = parseDate(addDays(cursor, 1));
    }
    return values;
  }

  const officialHolidayDates = new Set(
    Object.values(officialHolidayRanges).flatMap((ranges) => ranges.flatMap(([start, end]) => expandRange(start, end))),
  );

  function countWorkdays(start, end) {
    const begin = parseDate(start);
    const finish = parseDate(end);
    if (!begin || !finish || begin > finish) return { count: 0, calendarCovered: false };
    let count = 0;
    let cursor = begin;
    while (cursor <= finish) {
      const weekday = cursor.getUTCDay();
      const key = formatDateKey(cursor);
      if (weekday !== 0 && weekday !== 6 && !officialHolidayDates.has(key)) count += 1;
      cursor = parseDate(addDays(cursor, 1));
    }
    const startYear = begin.getUTCFullYear();
    const endYear = finish.getUTCFullYear();
    const calendarCovered = Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index)
      .every((year) => Object.prototype.hasOwnProperty.call(officialHolidayRanges, year));
    return { count, calendarCovered };
  }

  function summarizePlan(startDate, nodes) {
    const source = Array.isArray(nodes) ? nodes : [];
    const totalDays = source.reduce((sum, item) => sum + Math.max(1, Number(item.durationDays || 1)), 0);
    const finishDate = startDate && totalDays ? addDays(startDate, totalDays - 1) : '';
    const workday = countWorkdays(startDate, finishDate);
    return {
      nodeCount: source.length,
      totalDays,
      finishDate,
      workdays: workday.count,
      calendarCovered: workday.calendarCovered,
      coverageLabel: workday.calendarCovered ? '已扣除周末和法定节假日' : '含未公布节假日年份，暂只扣周末及已公布节假日',
    };
  }

  return Object.freeze({ addDays, countWorkdays, summarizePlan, officialHolidayRanges });
});
