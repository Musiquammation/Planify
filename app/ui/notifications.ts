/**
 * notifications.ts — Local notification management via Capacitor.
 * Uses @capacitor/local-notifications for Android compatibility.
 */

import { LocalNotifications } from '@capacitor/local-notifications';
import { store } from '../state/store.js';
import { toDayNumber } from '../utils/date.js';
import { minutesToTime } from '../utils/time.js';

// ─── Storage keys ──────────────────────────────────────────────────────────

const SLOT_REMINDER_KEY  = 'notif_slot_offsets'; // number[] sorted desc
const DAILY_REMINDER_KEY = 'notif_daily_time';   // "HH:MM" | null

// ─── Notification ID ranges ────────────────────────────────────────────────
// Capacitor needs stable integer IDs to cancel/replace notifs.
// We use deterministic IDs based on slot start time + offset.

const DAILY_NOTIF_ID = 999999;

function slotNotifId(slotAbsoluteMinute: number, offsetMin: number): number {
  return Math.abs((slotAbsoluteMinute * 100 + offsetMin) % 2_000_000);
}

// ─── Load / save ───────────────────────────────────────────────────────────

export function loadSlotOffsets(): number[] {
  try {
    const raw = localStorage.getItem(SLOT_REMINDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as number[];
    return [...new Set(parsed)].sort((a, b) => b - a);
  } catch { return []; }
}

export function saveSlotOffsets(offsets: number[]): void {
  const sorted = [...new Set(offsets)].sort((a, b) => b - a);
  localStorage.setItem(SLOT_REMINDER_KEY, JSON.stringify(sorted));
}

export function loadDailyTime(): string | null {
  return localStorage.getItem(DAILY_REMINDER_KEY) || null;
}

export function saveDailyTime(time: string | null): void {
  if (time) localStorage.setItem(DAILY_REMINDER_KEY, time);
  else localStorage.removeItem(DAILY_REMINDER_KEY);
}

// ─── Permission ────────────────────────────────────────────────────────────

export async function requestPermission(): Promise<boolean> {
  const result = await LocalNotifications.requestPermissions();
  return result.display === 'granted';
}

export async function getPermissionStatus(): Promise<'granted' | 'denied' | 'prompt'> {
  const result = await LocalNotifications.checkPermissions();
  return result.display as 'granted' | 'denied' | 'prompt';
}

// ─── Slot reminders ────────────────────────────────────────────────────────

export async function rescheduleSlotReminders(): Promise<void> {
  const offsets = loadSlotOffsets();

  // Cancel all previously scheduled slot reminders
  try {
    const pending = await LocalNotifications.getPending();
    const slotIds = pending.notifications
      .map(n => n.id)
      .filter(id => id !== DAILY_NOTIF_ID);
    if (slotIds.length > 0) {
      await LocalNotifications.cancel({ notifications: slotIds.map(id => ({ id })) });
    }
  } catch { /* ignore */ }

  if (offsets.length === 0) return;

  const status = await getPermissionStatus();
  if (status !== 'granted') return;

  const now = Date.now();
  const toSchedule: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = [];

  Object.entries(store).forEach(([dateKey, slots]) => {
    const [y, m, d] = dateKey.split('-').map(Number);
    const dateMs = new Date(y, m - 1, d).getTime();

    slots.forEach(slot => {
      if (slot.done) return;
      const slotStartMs = dateMs + slot.start * 60_000;
      const slotAbsMin  = toDayNumber(y, m, d) * 24 * 60 + slot.start;

      offsets.forEach(offsetMin => {
        const fireMs = slotStartMs - offsetMin * 60_000;
        if (fireMs <= now) return;

        const slotName = slot.name ?? 'Slot';
        const timeStr  = minutesToTime(slot.start);
        const body     = offsetMin === 0
          ? `${slotName} stars now.`
          : `${slotName} stars in ${offsetMin} mn (${timeStr}).`;

        toSchedule.push({
          id:    slotNotifId(slotAbsMin, offsetMin),
          title: 'Planify — Reminder',
          body,
          schedule: { at: new Date(fireMs), allowWhileIdle: true },
          sound: undefined,
          attachments: undefined,
          actionTypeId: '',
          extra: null,
        });
      });
    });
  });

  if (toSchedule.length > 0) {
    await LocalNotifications.schedule({ notifications: toSchedule });
  }
}

// ─── Daily reminder ────────────────────────────────────────────────────────

export async function rescheduleDailyReminder(): Promise<void> {
  // Cancel existing daily notif
  try {
    await LocalNotifications.cancel({ notifications: [{ id: DAILY_NOTIF_ID }] });
  } catch { /* ignore */ }

  const timeStr = loadDailyTime();
  if (!timeStr) return;

  const status = await getPermissionStatus();
  if (status !== 'granted') return;

  const [hh, mm] = timeStr.split(':').map(Number);
  const fire = new Date();
  fire.setHours(hh, mm, 0, 0);
  if (fire.getTime() <= Date.now()) fire.setDate(fire.getDate() + 1);

  await LocalNotifications.schedule({
    notifications: [{
      id:    DAILY_NOTIF_ID,
      title: "Don't forget Planify",
      body:  "It's time to add tasks to the list!",
      schedule: {
        at: fire,
        repeats: true,
        allowWhileIdle: true,
      },
      sound: undefined,
      attachments: undefined,
      actionTypeId: '',
      extra: null,
    }],
  });
}

// ─── Init ──────────────────────────────────────────────────────────────────

export async function initNotifications(): Promise<void> {
  const status = await getPermissionStatus();
  if (status === 'granted') {
    await rescheduleSlotReminders();
    await rescheduleDailyReminder();
  }
}