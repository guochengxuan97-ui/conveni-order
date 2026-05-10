'use client';
import { useState, useEffect } from 'react';
import { FactorSettings, DEFAULT_FACTOR_SETTINGS, WeatherType, EventRecord, SaleCampaign, VacationPeriod, AcademicPeriod, AcademicPeriodType, AcademicCalendarData } from '@/lib/types';

type TabKey = 'factors' | 'events' | 'campaigns' | 'vacations' | 'academic';

const PERIOD_TYPE_LABELS: Record<AcademicPeriodType, string> = {
  class: '授業期間',
  exam: '試験期間',
  vacation: '休暇期間',
  event: 'イベント',
  closed: '休校日',
};

const PERIOD_TYPE_COLORS: Record<AcademicPeriodType, string> = {
  class: 'bg-blue-100 text-blue-700',
  exam: 'bg-yellow-100 text-yellow-700',
  vacation: 'bg-purple-100 text-purple-700',
  event: 'bg-green-100 text-green-700',
  closed: 'bg-red-100 text-red-700',
};

const WEATHER_KEYS: { key: WeatherType; label: string; icon: string }[] = [
  { key: '晴れ', label: '晴れ', icon: '☀️' },
  { key: '曇り', label: '曇り', icon: '☁️' },
  { key: '雨', label: '雨', icon: '🌧️' },
  { key: '雪', label: '雪', icon: '❄️' },
];

function factorToPct(f: number): number {
  return Math.round((f - 1) * 100);
}

function pctToFactor(p: number): number {
  return 1 + p / 100;
}

interface EventModalState {
  open: boolean;
  editing: EventRecord | null;
  date: string;
  name: string;
  note: string;
}

interface CampaignModalState {
  open: boolean;
  editing: SaleCampaign | null;
  dateFrom: string;
  dateTo: string;
  name: string;
  note: string;
}

interface VacationModalState {
  open: boolean;
  editing: VacationPeriod | null;
  name: string;
  dateFrom: string;
  dateTo: string;
  reductionPct: number;
  note: string;
}

interface AcademicPeriodModalState {
  open: boolean;
  editing: AcademicPeriod | null;
  type: AcademicPeriodType;
  name: string;
  dateFrom: string;
  dateTo: string;
  orderFactor: number;
  note: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('factors');

  // Factor settings
  const [settings, setSettings] = useState<FactorSettings>(DEFAULT_FACTOR_SETTINGS);
  const [weatherPct, setWeatherPct] = useState<Record<WeatherType, number>>({
    '晴れ': factorToPct(DEFAULT_FACTOR_SETTINGS.weather['晴れ']),
    '曇り': factorToPct(DEFAULT_FACTOR_SETTINGS.weather['曇り']),
    '雨': factorToPct(DEFAULT_FACTOR_SETTINGS.weather['雨']),
    '雪': factorToPct(DEFAULT_FACTOR_SETTINGS.weather['雪']),
  });
  const [eventPct, setEventPct] = useState(factorToPct(DEFAULT_FACTOR_SETTINGS.event));
  const [salePct, setSalePct] = useState(factorToPct(DEFAULT_FACTOR_SETTINGS.sale));
  const [holidayPct, setHolidayPct] = useState(factorToPct(DEFAULT_FACTOR_SETTINGS.holiday));
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Events
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [eventModal, setEventModal] = useState<EventModalState>({
    open: false, editing: null, date: '', name: '', note: '',
  });
  const [savingEvent, setSavingEvent] = useState(false);

  // Campaigns
  const [campaigns, setCampaigns] = useState<SaleCampaign[]>([]);
  const [campaignModal, setCampaignModal] = useState<CampaignModalState>({
    open: false, editing: null, dateFrom: '', dateTo: '', name: '', note: '',
  });
  const [savingCampaign, setSavingCampaign] = useState(false);

  // Vacations
  const [vacations, setVacations] = useState<VacationPeriod[]>([]);
  const [vacationModal, setVacationModal] = useState<VacationModalState>({
    open: false, editing: null, name: '', dateFrom: '', dateTo: '', reductionPct: 15, note: '',
  });
  const [savingVacation, setSavingVacation] = useState(false);

  // Academic calendar
  const [academicCalendar, setAcademicCalendar] = useState<AcademicCalendarData | null>(null);
  const [academicModal, setAcademicModal] = useState<AcademicPeriodModalState>({
    open: false, editing: null, type: 'class', name: '', dateFrom: '', dateTo: '', orderFactor: 1.0, note: '',
  });
  const [savingAcademic, setSavingAcademic] = useState(false);
  const [fetchingCalendar, setFetchingCalendar] = useState(false);
  const [fetchCalendarError, setFetchCalendarError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data: FactorSettings) => {
        setSettings(data);
        setWeatherPct({
          '晴れ': factorToPct(data.weather['晴れ']),
          '曇り': factorToPct(data.weather['曇り']),
          '雨': factorToPct(data.weather['雨']),
          '雪': factorToPct(data.weather['雪']),
        });
        setEventPct(factorToPct(data.event));
        setSalePct(factorToPct(data.sale));
        setHolidayPct(factorToPct(data.holiday ?? DEFAULT_FACTOR_SETTINGS.holiday));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/events').then((r) => r.json()).then(setEvents).catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/sales-campaigns').then((r) => r.json()).then(setCampaigns).catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/vacations').then((r) => r.json()).then(setVacations).catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/academic-calendar').then((r) => r.json()).then(setAcademicCalendar).catch(() => {});
  }, []);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    const newSettings: FactorSettings = {
      weather: {
        '晴れ': pctToFactor(weatherPct['晴れ']),
        '曇り': pctToFactor(weatherPct['曇り']),
        '雨': pctToFactor(weatherPct['雨']),
        '雪': pctToFactor(weatherPct['雪']),
      },
      event: pctToFactor(eventPct),
      sale: pctToFactor(salePct),
      holiday: pctToFactor(holidayPct),
    };
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings),
    });
    setSettings(newSettings);
    setSavingSettings(false);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  }

  function openNewEvent() {
    setEventModal({ open: true, editing: null, date: '', name: '', note: '' });
  }

  function openEditEvent(ev: EventRecord) {
    setEventModal({ open: true, editing: ev, date: ev.date, name: ev.name, note: ev.note });
  }

  async function submitEvent(e: React.FormEvent) {
    e.preventDefault();
    setSavingEvent(true);
    if (eventModal.editing) {
      await fetch('/api/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eventModal.editing.id, date: eventModal.date, name: eventModal.name, note: eventModal.note }),
      });
    } else {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: eventModal.date, name: eventModal.name, note: eventModal.note }),
      });
    }
    setSavingEvent(false);
    setEventModal((prev) => ({ ...prev, open: false }));
    const res = await fetch('/api/events');
    setEvents(await res.json());
  }

  async function deleteEvent(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    await fetch(`/api/events?id=${id}`, { method: 'DELETE' });
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  function openNewCampaign() {
    setCampaignModal({ open: true, editing: null, dateFrom: '', dateTo: '', name: '', note: '' });
  }

  function openEditCampaign(c: SaleCampaign) {
    setCampaignModal({ open: true, editing: c, dateFrom: c.dateFrom, dateTo: c.dateTo, name: c.name, note: c.note });
  }

  async function submitCampaign(e: React.FormEvent) {
    e.preventDefault();
    setSavingCampaign(true);
    if (campaignModal.editing) {
      await fetch('/api/sales-campaigns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: campaignModal.editing.id,
          dateFrom: campaignModal.dateFrom,
          dateTo: campaignModal.dateTo,
          name: campaignModal.name,
          note: campaignModal.note,
        }),
      });
    } else {
      await fetch('/api/sales-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateFrom: campaignModal.dateFrom,
          dateTo: campaignModal.dateTo,
          name: campaignModal.name,
          note: campaignModal.note,
        }),
      });
    }
    setSavingCampaign(false);
    setCampaignModal((prev) => ({ ...prev, open: false }));
    const res = await fetch('/api/sales-campaigns');
    setCampaigns(await res.json());
  }

  async function deleteCampaign(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    await fetch(`/api/sales-campaigns?id=${id}`, { method: 'DELETE' });
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  }

  function openNewVacation() {
    setVacationModal({ open: true, editing: null, name: '', dateFrom: '', dateTo: '', reductionPct: 15, note: '' });
  }

  function openEditVacation(v: VacationPeriod) {
    setVacationModal({ open: true, editing: v, name: v.name, dateFrom: v.dateFrom, dateTo: v.dateTo, reductionPct: v.reductionPct, note: v.note });
  }

  async function submitVacation(e: React.FormEvent) {
    e.preventDefault();
    setSavingVacation(true);
    if (vacationModal.editing) {
      await fetch('/api/vacations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: vacationModal.editing.id, name: vacationModal.name, dateFrom: vacationModal.dateFrom, dateTo: vacationModal.dateTo, reductionPct: vacationModal.reductionPct, note: vacationModal.note }),
      });
    } else {
      await fetch('/api/vacations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: vacationModal.name, dateFrom: vacationModal.dateFrom, dateTo: vacationModal.dateTo, reductionPct: vacationModal.reductionPct, note: vacationModal.note }),
      });
    }
    setSavingVacation(false);
    setVacationModal((prev) => ({ ...prev, open: false }));
    const res = await fetch('/api/vacations');
    setVacations(await res.json());
  }

  async function deleteVacation(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    await fetch(`/api/vacations?id=${id}`, { method: 'DELETE' });
    setVacations((prev) => prev.filter((v) => v.id !== id));
  }

  async function fetchAcademicCalendar() {
    setFetchingCalendar(true);
    setFetchCalendarError(null);
    const year = academicCalendar?.academicYear ?? new Date().getFullYear();
    const res = await fetch('/api/academic-calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'fetch', year }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFetchCalendarError(data.error ?? '取得に失敗しました');
    } else {
      setAcademicCalendar(data);
    }
    setFetchingCalendar(false);
  }

  async function changeAcademicYear(year: number) {
    await fetch('/api/academic-calendar', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setYear', year }),
    });
    setAcademicCalendar((prev) => prev ? { ...prev, academicYear: year } : prev);
  }

  function openNewAcademicPeriod() {
    setAcademicModal({ open: true, editing: null, type: 'class', name: '', dateFrom: '', dateTo: '', orderFactor: 1.0, note: '' });
  }

  function openEditAcademicPeriod(p: AcademicPeriod) {
    setAcademicModal({ open: true, editing: p, type: p.type, name: p.name, dateFrom: p.dateFrom, dateTo: p.dateTo, orderFactor: p.orderFactor, note: p.note });
  }

  async function submitAcademicPeriod(e: React.FormEvent) {
    e.preventDefault();
    setSavingAcademic(true);
    if (academicModal.editing) {
      await fetch('/api/academic-calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: academicModal.editing.id,
          type: academicModal.type,
          name: academicModal.name,
          dateFrom: academicModal.dateFrom,
          dateTo: academicModal.dateTo,
          orderFactor: academicModal.orderFactor,
          note: academicModal.note,
        }),
      });
    } else {
      await fetch('/api/academic-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: academicModal.type,
          name: academicModal.name,
          dateFrom: academicModal.dateFrom,
          dateTo: academicModal.dateTo,
          orderFactor: academicModal.orderFactor,
          note: academicModal.note,
        }),
      });
    }
    setSavingAcademic(false);
    setAcademicModal((prev) => ({ ...prev, open: false }));
    const res = await fetch('/api/academic-calendar');
    setAcademicCalendar(await res.json());
  }

  async function deleteAcademicPeriod(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    await fetch(`/api/academic-calendar?id=${id}`, { method: 'DELETE' });
    setAcademicCalendar((prev) =>
      prev ? { ...prev, periods: prev.periods.filter((p) => p.id !== id) } : prev
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'factors', label: '外部要因設定' },
    { key: 'events', label: 'イベント管理' },
    { key: 'campaigns', label: 'セール管理' },
    { key: 'vacations', label: '大学休暇期間' },
    { key: 'academic', label: '学年歴' },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-800">設定</h1>

      {/* Event modal */}
      {eventModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {eventModal.editing ? 'イベントを編集' : 'イベント追加'}
            </h2>
            <form onSubmit={submitEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
                <input
                  type="date"
                  required
                  value={eventModal.date}
                  onChange={(e) => setEventModal((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">イベント名</label>
                <input
                  type="text"
                  required
                  value={eventModal.name}
                  onChange={(e) => setEventModal((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="例: 花火大会"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                <input
                  type="text"
                  value={eventModal.note}
                  onChange={(e) => setEventModal((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="任意"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={savingEvent}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {savingEvent ? '保存中...' : '保存'}
                </button>
                <button
                  type="button"
                  onClick={() => setEventModal((prev) => ({ ...prev, open: false }))}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Campaign modal */}
      {campaignModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {campaignModal.editing ? 'セールを編集' : 'セール追加'}
            </h2>
            <form onSubmit={submitCampaign} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始日</label>
                  <input
                    type="date"
                    required
                    value={campaignModal.dateFrom}
                    onChange={(e) => setCampaignModal((prev) => ({ ...prev, dateFrom: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">終了日</label>
                  <input
                    type="date"
                    required
                    value={campaignModal.dateTo}
                    onChange={(e) => setCampaignModal((prev) => ({ ...prev, dateTo: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">セール名</label>
                <input
                  type="text"
                  required
                  value={campaignModal.name}
                  onChange={(e) => setCampaignModal((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="例: 夏の特売"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                <input
                  type="text"
                  value={campaignModal.note}
                  onChange={(e) => setCampaignModal((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="任意"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={savingCampaign}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {savingCampaign ? '保存中...' : '保存'}
                </button>
                <button
                  type="button"
                  onClick={() => setCampaignModal((prev) => ({ ...prev, open: false }))}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vacation modal */}
      {vacationModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {vacationModal.editing ? '休暇期間を編集' : '大学休暇期間を追加'}
            </h2>
            <form onSubmit={submitVacation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">期間名</label>
                <input
                  type="text"
                  required
                  value={vacationModal.name}
                  onChange={(e) => setVacationModal((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="例: GW、夏休み、春休み"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始日</label>
                  <input
                    type="date"
                    required
                    value={vacationModal.dateFrom}
                    onChange={(e) => setVacationModal((prev) => ({ ...prev, dateFrom: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">終了日</label>
                  <input
                    type="date"
                    required
                    value={vacationModal.dateTo}
                    onChange={(e) => setVacationModal((prev) => ({ ...prev, dateTo: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  発注削減率（%）
                  <span className="text-gray-400 font-normal ml-1">— この期間は通常より何%減らすか</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    required
                    min={1}
                    max={50}
                    value={vacationModal.reductionPct}
                    onChange={(e) => setVacationModal((prev) => ({ ...prev, reductionPct: parseInt(e.target.value) || 15 }))}
                    className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                  />
                  <span className="text-sm text-gray-500">% 削減</span>
                  <span className="text-sm font-medium text-red-500">→ {100 - vacationModal.reductionPct}%に補正</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                <input
                  type="text"
                  value={vacationModal.note}
                  onChange={(e) => setVacationModal((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="任意"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={savingVacation}
                  className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {savingVacation ? '保存中...' : '保存'}
                </button>
                <button
                  type="button"
                  onClick={() => setVacationModal((prev) => ({ ...prev, open: false }))}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Academic period modal */}
      {academicModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {academicModal.editing ? '期間を編集' : '学年歴期間を追加'}
            </h2>
            <form onSubmit={submitAcademicPeriod} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">種別</label>
                <select
                  value={academicModal.type}
                  onChange={(e) => setAcademicModal((prev) => ({ ...prev, type: e.target.value as AcademicPeriodType }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="class">授業期間</option>
                  <option value="exam">試験期間</option>
                  <option value="vacation">休暇期間</option>
                  <option value="event">イベント</option>
                  <option value="closed">休校日</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">期間名</label>
                <input
                  type="text"
                  required
                  value={academicModal.name}
                  onChange={(e) => setAcademicModal((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="例: 春学期授業期間、夏季休暇"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始日</label>
                  <input
                    type="date"
                    required
                    value={academicModal.dateFrom}
                    onChange={(e) => setAcademicModal((prev) => ({ ...prev, dateFrom: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">終了日</label>
                  <input
                    type="date"
                    required
                    value={academicModal.dateTo}
                    onChange={(e) => setAcademicModal((prev) => ({ ...prev, dateTo: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  発注補正係数
                  <span className="text-gray-400 font-normal ml-1">（1.0=通常、0.75=25%減、1.15=15%増）</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    required
                    min={0.1}
                    max={2.0}
                    step={0.05}
                    value={academicModal.orderFactor}
                    onChange={(e) => setAcademicModal((prev) => ({ ...prev, orderFactor: parseFloat(e.target.value) || 1.0 }))}
                    className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-center"
                  />
                  <span className={`text-sm font-medium ${
                    academicModal.orderFactor > 1 ? 'text-emerald-600' :
                    academicModal.orderFactor < 1 ? 'text-red-500' : 'text-gray-500'
                  }`}>
                    {academicModal.orderFactor > 1
                      ? `+${Math.round((academicModal.orderFactor - 1) * 100)}%`
                      : academicModal.orderFactor < 1
                      ? `${Math.round((academicModal.orderFactor - 1) * 100)}%`
                      : '±0%（通常）'}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                <input
                  type="text"
                  value={academicModal.note}
                  onChange={(e) => setAcademicModal((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="任意"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={savingAcademic}
                  className="flex-1 bg-violet-600 text-white py-2.5 rounded-lg font-medium hover:bg-violet-700 transition-colors disabled:opacity-50"
                >
                  {savingAcademic ? '保存中...' : '保存'}
                </button>
                <button
                  type="button"
                  onClick={() => setAcademicModal((prev) => ({ ...prev, open: false }))}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Factor settings tab */}
      {activeTab === 'factors' && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-700 mb-4">外部要因の補正率設定</h2>
          <form onSubmit={saveSettings} className="space-y-5">
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-600">天気別補正</div>
              {WEATHER_KEYS.map(({ key, label, icon }) => {
                const pct = weatherPct[key];
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xl w-7 shrink-0">{icon}</span>
                    <span className="text-sm text-gray-700 w-12 shrink-0">{label}</span>
                    <input
                      type="number"
                      value={pct}
                      onChange={(e) => setWeatherPct((prev) => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                      className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-center"
                    />
                    <span className="text-sm text-gray-500">%</span>
                    <span className={`text-xs font-medium ${pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {pct >= 0 ? `+${pct}%` : `${pct}%`}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div className="text-sm font-medium text-gray-600">その他の補正</div>
              <div className="flex items-center gap-3">
                <span className="text-xl w-7 shrink-0">🎪</span>
                <span className="text-sm text-gray-700 w-24 shrink-0">イベントあり</span>
                <input
                  type="number"
                  value={eventPct}
                  onChange={(e) => setEventPct(parseInt(e.target.value) || 0)}
                  className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-center"
                />
                <span className="text-sm text-gray-500">%</span>
                <span className={`text-xs font-medium ${eventPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {eventPct >= 0 ? `+${eventPct}%` : `${eventPct}%`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl w-7 shrink-0">🏷️</span>
                <span className="text-sm text-gray-700 w-24 shrink-0">セール実施</span>
                <input
                  type="number"
                  value={salePct}
                  onChange={(e) => setSalePct(parseInt(e.target.value) || 0)}
                  className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-center"
                />
                <span className="text-sm text-gray-500">%</span>
                <span className={`text-xs font-medium ${salePct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {salePct >= 0 ? `+${salePct}%` : `${salePct}%`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl w-7 shrink-0">🎌</span>
                <span className="text-sm text-gray-700 w-24 shrink-0">祝日（授業日）</span>
                <input
                  type="number"
                  value={holidayPct}
                  onChange={(e) => setHolidayPct(parseInt(e.target.value) || 0)}
                  className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-center"
                />
                <span className="text-sm text-gray-500">%</span>
                <span className={`text-xs font-medium ${holidayPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {holidayPct >= 0 ? `+${holidayPct}%` : `${holidayPct}%`}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400">※ 祝日補正は授業期間中の国民の祝日のみ適用。長期休暇中の祝日は学年歴補正のみ反映されます。</p>

            <button
              type="submit"
              disabled={savingSettings}
              className={`w-full py-2.5 rounded-lg font-medium transition-colors ${
                settingsSaved
                  ? 'bg-green-100 text-green-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              } disabled:opacity-50`}
            >
              {savingSettings ? '保存中...' : settingsSaved ? '✓ 保存しました' : '保存する'}
            </button>
          </form>
        </div>
      )}

      {/* Events tab */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">イベント一覧</h2>
            <button
              onClick={openNewEvent}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              + イベント追加
            </button>
          </div>
          {events.length === 0 ? (
            <div className="bg-white rounded-xl p-10 shadow-sm border border-gray-100 text-center text-gray-400">
              <div className="text-4xl mb-2">🎪</div>
              <div>イベントが登録されていません</div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-gray-500 font-medium">日付</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">イベント名</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">備考</th>
                      <th className="text-center px-3 py-2 text-gray-500 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events
                      .slice()
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((ev, idx) => (
                        <tr key={ev.id} className={`${idx > 0 ? 'border-t border-gray-50' : ''} hover:bg-gray-50`}>
                          <td className="px-4 py-2.5 text-gray-700">{ev.date}</td>
                          <td className="px-3 py-2.5 font-medium text-gray-800">{ev.name}</td>
                          <td className="px-3 py-2.5 text-gray-400">{ev.note || '-'}</td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex justify-center gap-3">
                              <button
                                onClick={() => openEditEvent(ev)}
                                className="text-blue-600 text-sm hover:underline"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => deleteEvent(ev.id, ev.name)}
                                className="text-red-500 text-sm hover:underline"
                              >
                                削除
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Campaigns tab */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">セールキャンペーン一覧</h2>
            <button
              onClick={openNewCampaign}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              + セール追加
            </button>
          </div>
          {campaigns.length === 0 ? (
            <div className="bg-white rounded-xl p-10 shadow-sm border border-gray-100 text-center text-gray-400">
              <div className="text-4xl mb-2">🏷️</div>
              <div>セールキャンペーンが登録されていません</div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-gray-500 font-medium">期間</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">セール名</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">備考</th>
                      <th className="text-center px-3 py-2 text-gray-500 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns
                      .slice()
                      .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))
                      .map((c, idx) => (
                        <tr key={c.id} className={`${idx > 0 ? 'border-t border-gray-50' : ''} hover:bg-gray-50`}>
                          <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{c.dateFrom} 〜 {c.dateTo}</td>
                          <td className="px-3 py-2.5 font-medium text-gray-800">{c.name}</td>
                          <td className="px-3 py-2.5 text-gray-400">{c.note || '-'}</td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex justify-center gap-3">
                              <button
                                onClick={() => openEditCampaign(c)}
                                className="text-blue-600 text-sm hover:underline"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => deleteCampaign(c.id, c.name)}
                                className="text-red-500 text-sm hover:underline"
                              >
                                削除
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Academic calendar tab */}
      {activeTab === 'academic' && (
        <div className="space-y-4">
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <span className="text-xl">📅</span>
              <div className="text-sm text-violet-800">
                <div className="font-semibold mb-1">法政大学多摩キャンパス — 学年歴</div>
                <div className="text-violet-600">授業期間・試験期間・長期休暇・イベントを登録すると、自動的に発注補正に反映されます。</div>
              </div>
            </div>
          </div>

          {/* Year + fetch controls */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">学年度</label>
              <input
                type="number"
                min={2020}
                max={2035}
                value={academicCalendar?.academicYear ?? new Date().getFullYear()}
                onChange={(e) => changeAcademicYear(parseInt(e.target.value))}
                className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-center"
              />
              <span className="text-sm text-gray-500">年度</span>
            </div>
            <button
              onClick={fetchAcademicCalendar}
              disabled={fetchingCalendar}
              className="bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {fetchingCalendar ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  取得中...
                </>
              ) : '🌐 大学サイトから自動取得'}
            </button>
            {academicCalendar?.fetchedAt && (
              <span className="text-xs text-gray-400">
                最終取得: {new Date(academicCalendar.fetchedAt).toLocaleString('ja-JP')}
              </span>
            )}
          </div>

          {fetchCalendarError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 whitespace-pre-line">
              ⚠️ {fetchCalendarError}
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">登録済み期間</h2>
            <button
              onClick={openNewAcademicPeriod}
              className="bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
            >
              + 期間を追加
            </button>
          </div>

          {(!academicCalendar || academicCalendar.periods.length === 0) ? (
            <div className="bg-white rounded-xl p-10 shadow-sm border border-gray-100 text-center text-gray-400">
              <div className="text-4xl mb-2">📅</div>
              <div>学年歴が登録されていません</div>
              <div className="text-sm mt-1">「大学サイトから自動取得」または「期間を追加」から登録してください</div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-gray-500 font-medium">種別</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">期間名</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">期間</th>
                      <th className="text-center px-3 py-2 text-gray-500 font-medium">補正</th>
                      <th className="text-center px-3 py-2 text-gray-500 font-medium">取得元</th>
                      <th className="text-center px-3 py-2 text-gray-500 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {academicCalendar.periods
                      .slice()
                      .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))
                      .map((p, idx) => {
                        const factorPct = Math.round((p.orderFactor - 1) * 100);
                        return (
                          <tr key={p.id} className={`${idx > 0 ? 'border-t border-gray-50' : ''} hover:bg-gray-50`}>
                            <td className="px-4 py-2.5">
                              <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${PERIOD_TYPE_COLORS[p.type]}`}>
                                {PERIOD_TYPE_LABELS[p.type]}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-medium text-gray-800">{p.name}</td>
                            <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{p.dateFrom} 〜 {p.dateTo}</td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`text-xs font-medium ${
                                factorPct > 0 ? 'text-emerald-600' : factorPct < 0 ? 'text-red-500' : 'text-gray-400'
                              }`}>
                                {factorPct > 0 ? `+${factorPct}%` : factorPct < 0 ? `${factorPct}%` : '±0%'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`text-xs rounded-full px-2 py-0.5 ${
                                p.source === 'auto' ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {p.source === 'auto' ? '自動' : '手動'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex justify-center gap-3">
                                <button
                                  onClick={() => openEditAcademicPeriod(p)}
                                  className="text-blue-600 text-sm hover:underline"
                                >
                                  編集
                                </button>
                                <button
                                  onClick={() => deleteAcademicPeriod(p.id, p.name)}
                                  className="text-red-500 text-sm hover:underline"
                                >
                                  削除
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vacations tab */}
      {activeTab === 'vacations' && (
        <div className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <span className="text-xl">🎓</span>
              <div className="text-sm text-indigo-800">
                <div className="font-semibold mb-1">法政大学入口店 — 大学休暇期間補正</div>
                <div className="text-indigo-600">大学の長期休暇中は学生客が減少するため、自動的に発注数を削減します。発注試算・AI発注推奨の両方に反映されます。</div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">登録済み休暇期間</h2>
            <button
              onClick={openNewVacation}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              + 期間を追加
            </button>
          </div>
          {vacations.length === 0 ? (
            <div className="bg-white rounded-xl p-10 shadow-sm border border-gray-100 text-center text-gray-400">
              <div className="text-4xl mb-2">🎓</div>
              <div>大学休暇期間が登録されていません</div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-gray-500 font-medium">期間名</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">期間</th>
                      <th className="text-center px-3 py-2 text-gray-500 font-medium">削減率</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">備考</th>
                      <th className="text-center px-3 py-2 text-gray-500 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vacations
                      .slice()
                      .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))
                      .map((v, idx) => (
                        <tr key={v.id} className={`${idx > 0 ? 'border-t border-gray-50' : ''} hover:bg-gray-50`}>
                          <td className="px-4 py-2.5 font-medium text-gray-800">
                            <span className="mr-1">🎓</span>{v.name}
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                            {v.dateFrom} 〜 {v.dateTo}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5 text-xs font-medium">
                              -{v.reductionPct}%
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-400">{v.note || '-'}</td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex justify-center gap-3">
                              <button
                                onClick={() => openEditVacation(v)}
                                className="text-blue-600 text-sm hover:underline"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => deleteVacation(v.id, v.name)}
                                className="text-red-500 text-sm hover:underline"
                              >
                                削除
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
