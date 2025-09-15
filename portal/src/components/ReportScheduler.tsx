import React, { useState } from 'react';
import { Calendar, Clock, Mail, X } from 'lucide-react';

interface ReportSchedulerProps {
  reportTemplate: string;
  reportName: string;
  onSchedule: (schedule: ScheduleConfig) => void;
  onClose: () => void;
}

interface ScheduleConfig {
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  recipients: string[];
  format: 'pdf' | 'excel' | 'csv';
  parameters: any;
}

const ReportScheduler: React.FC<ReportSchedulerProps> = ({ 
  reportTemplate, 
  reportName, 
  onSchedule, 
  onClose 
}) => {
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [time, setTime] = useState('08:00');
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [recipients, setRecipients] = useState(localStorage.getItem('userEmail') || '');
  const [format, setFormat] = useState<'pdf' | 'excel' | 'csv'>('pdf');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const schedule: ScheduleConfig = {
      frequency,
      time,
      recipients: recipients.split(',').map(email => email.trim()),
      format,
      parameters: { template: reportTemplate }
    };

    if (frequency === 'weekly') {
      schedule.dayOfWeek = dayOfWeek;
    } else if (frequency === 'monthly') {
      schedule.dayOfMonth = dayOfMonth;
    }

    onSchedule(schedule);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Schedule Report: {reportName}</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>
              <Calendar size={16} />
              Frequency
            </label>
            <select 
              value={frequency} 
              onChange={(e) => setFrequency(e.target.value as any)}
              className="form-control"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {frequency === 'weekly' && (
            <div className="form-group">
              <label>Day of Week</label>
              <select 
                value={dayOfWeek} 
                onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                className="form-control"
              >
                <option value="0">Sunday</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
              </select>
            </div>
          )}

          {frequency === 'monthly' && (
            <div className="form-group">
              <label>Day of Month</label>
              <input 
                type="number" 
                min="1" 
                max="31" 
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                className="form-control"
              />
            </div>
          )}

          <div className="form-group">
            <label>
              <Clock size={16} />
              Time
            </label>
            <input 
              type="time" 
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label>
              <Mail size={16} />
              Recipients (comma separated)
            </label>
            <input 
              type="text" 
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="email@example.com, another@example.com"
              className="form-control"
              required
            />
          </div>

          <div className="form-group">
            <label>Format</label>
            <select 
              value={format} 
              onChange={(e) => setFormat(e.target.value as any)}
              className="form-control"
            >
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
              <option value="csv">CSV</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn-primary">
              Schedule Report
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportScheduler;