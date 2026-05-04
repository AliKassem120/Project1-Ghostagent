'use client';

import React, { useEffect, useState } from 'react';
import { fetchGodMode } from '@/lib/god-mode/api-client';
import { Loader2 } from 'lucide-react';

export default function AppointmentsSection() {
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadAppointments = () => {
        setLoading(true);
        fetchGodMode('appointments').then(res => {
            setAppointments(res.appointments);
            setLoading(false);
        }).catch(console.error);
    };

    useEffect(() => { loadAppointments(); }, []);

    const updateStatus = async (appointmentId: string, status: string) => {
        try {
            await fetchGodMode('appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appointmentId, status })
            });
            loadAppointments();
        } catch (err) {
            console.error(err);
            alert('Failed to update appointment');
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div>;

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold">Appointments Debugger</h2>
            <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-surface-2 text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 font-medium">Workspace</th>
                                <th className="px-4 py-3 font-medium">Service</th>
                                <th className="px-4 py-3 font-medium">Customer</th>
                                <th className="px-4 py-3 font-medium">Time</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {appointments.map(a => (
                                <tr key={a.id} className="hover:bg-surface-2/50 transition-colors">
                                    <td className="px-4 py-3 font-medium">{a.workspaceName}</td>
                                    <td className="px-4 py-3">{a.service_name}</td>
                                    <td className="px-4 py-3">
                                        <div>{a.customer_name}</div>
                                        <div className="text-xs text-muted-foreground">{a.customer_phone}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div>{a.appointment_date}</div>
                                        <div className="text-xs text-muted-foreground">{a.start_time} - {a.end_time}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded text-xs ${a.status === 'confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-surface-2'}`}>
                                            {a.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <select 
                                            value={a.status} 
                                            onChange={e => updateStatus(a.id, e.target.value)}
                                            className="bg-surface-2 border border-border rounded text-xs px-2 py-1"
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="confirmed">Confirmed</option>
                                            <option value="completed">Completed</option>
                                            <option value="cancelled">Cancelled</option>
                                            <option value="no_show">No Show</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
