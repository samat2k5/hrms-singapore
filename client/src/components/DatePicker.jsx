import React from 'react';
import ReactDatePicker from 'react-datepicker';
import { Calendar } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';

const DatePicker = ({ selected, onChange, placeholderText, required, label }) => {
    return (
        <div className="relative">
            {label && (
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">
                    {label} {required && <span className="text-rose-500">*</span>}
                </label>
            )}
            <div className="relative group">
                <ReactDatePicker
                    selected={selected ? new Date(selected) : null}
                    onChange={(date) => {
                        if (date) {
                            // Format as YYYY-MM-DD for backend compatibility
                            const offset = date.getTimezoneOffset();
                            const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
                            onChange(adjustedDate.toISOString().split('T')[0]);
                        } else {
                            onChange('');
                        }
                    }}
                    placeholderText={placeholderText}
                    className="input-base w-full pr-10 cursor-pointer"
                    dateFormat="dd MMM yyyy"
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    required={required}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-hover:text-[var(--brand-primary)] transition-colors pointer-events-none">
                    <Calendar className="w-5 h-5" />
                </div>
            </div>
        </div>
    );
};

export default DatePicker;
