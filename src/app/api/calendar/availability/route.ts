import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@/utils/supabase/server';
import { format, addMinutes, parseISO, isBefore, isAfter, setHours, setMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { userId, date, timezone = 'Asia/Beirut' } = body;

        // 1. Validate incoming request
        if (!userId || !date) {
            return NextResponse.json({ error: 'Missing required fields: userId or date.' }, { status: 400 });
        }

        // 2. Fetch the user's refresh token from Supabase
        const supabase = await createClient();
        const { data: user, error: dbError } = await supabase
            .from('users')
            .select('google_refresh_token')
            .eq('id', userId)
            .single();

        if (dbError || !user?.google_refresh_token) {
            return NextResponse.json({ error: 'Calendar is not connected.' }, { status: 400 });
        }

        // 3. Initialize Google OAuth Client
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );

        // Set the credentials using the stored refresh token
        oauth2Client.setCredentials({
            refresh_token: user.google_refresh_token
        });

        // Initialize the Calendar API client
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        // 4. Define Working Hours constraint
        // Set the boundary for the queried day (e.g. 09:00 to 17:00 in the target timezone)
        const queryDate = new Date(date);

        // Ensure the date is interpreted correctly in the target timezone
        const zonedQueryDate = toZonedTime(queryDate, timezone);

        // Define Start Time: 09:00 AM
        const dayStart = setHours(setMinutes(zonedQueryDate, 0), 9);
        // Define End Time: 17:00 PM (5:00 PM)
        const dayEnd = setHours(setMinutes(zonedQueryDate, 0), 17);

        // Convert boundary times to proper ISO string formats for Google Calendar Query
        const timeMin = dayStart.toISOString();
        const timeMax = dayEnd.toISOString();

        // 5. Query Google Calendar Free/Busy times
        let freeBusyResponse;
        try {
            freeBusyResponse = await calendar.freebusy.query({
                requestBody: {
                    timeMin,
                    timeMax,
                    timeZone: timezone,
                    items: [{ id: 'primary' }] // 'primary' targets the user's main calendar
                }
            });
        } catch (authError: any) {
            console.error("Google Calendar API Error:", authError);

            // Handle token revokations or invalid grants
            if (authError.message === 'invalid_grant') {
                return NextResponse.json({
                    error: 'Google Calendar access revoked or expired. Re-connection required.',
                    needsReauth: true
                }, { status: 401 });
            }
            throw authError; // Rethrow general errors
        }

        // 6. Extract the busy intervals from Google's response
        const calendars = freeBusyResponse.data.calendars;
        const busyIntervals = calendars && calendars.primary ? calendars.primary.busy || [] : [];

        // 7. Calculate Available 30-minute Slots
        const availableSlots: string[] = [];
        let currentSlotStart = dayStart;
        const SLOT_DURATION_MINUTES = 30;

        // Loop to generate slots from dayStart (09:00) until dayEnd (17:00)
        while (isBefore(currentSlotStart, dayEnd)) {
            const currentSlotEnd = addMinutes(currentSlotStart, SLOT_DURATION_MINUTES);

            // Check if this particular slot overlaps with ANY of the busy intervals from Google
            const isBusy = busyIntervals.some((busyPeriod: any) => {
                const busyStart = parseISO(busyPeriod.start);
                const busyEnd = parseISO(busyPeriod.end);

                // Validation logic: A slot overlaps if it starts before the busy period ends AND ends after the busy period starts
                return (
                    isBefore(currentSlotStart, busyEnd) && isAfter(currentSlotEnd, busyStart)
                );
            });

            // If the slot is free, format it and push to array
            if (!isBusy) {
                // Formatting to "09:00 AM" 
                availableSlots.push(format(currentSlotStart, "hh:mm a"));
            }

            // Advance the cursor by 30 minutes for the next loop iteration
            currentSlotStart = currentSlotEnd;
        }

        // Return the final list of clean, available slots
        return NextResponse.json({
            date,
            timezone,
            availableSlots
        });

    } catch (error: any) {
        console.error('Unhandled Error specifically inside Availability route:', error);
        return NextResponse.json({ error: 'Failed to calculate calendar availability.' }, { status: 500 });
    }
}
