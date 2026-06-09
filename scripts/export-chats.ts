import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
    console.log('--- WhatsApp Chat Log Exporter ---');
    console.log('Connecting to Supabase...');
    
    // 1. Fetch all activity logs
    const { data: logs, error } = await supabase
        .from('activity_log')
        .select('*')
        .order('timestamp', { ascending: true });

    if (error) {
        console.error('Error fetching logs:', error);
        return;
    }

    console.log(`Fetched ${logs?.length || 0} total log rows from database.`);

    // 2. Filter specifically for WhatsApp logs
    const whatsappLogs = logs?.filter(log => {
        const platform = (log.metadata?.platform || log.metadata?.platform_type || '').toLowerCase();
        const desc = (log.description || '').toLowerCase();
        return platform === 'whatsapp' || desc.includes('whatsapp');
    }) || [];

    console.log(`Found ${whatsappLogs.length} WhatsApp-related log rows.`);

    // 3. Group logs by chat_id
    const chats: Record<string, any[]> = {};
    for (const log of whatsappLogs) {
        const chatId = log.metadata?.chat_id || log.metadata?.chatId || 'unknown_chat';
        if (!chats[chatId]) {
            chats[chatId] = [];
        }
        chats[chatId].push(log);
    }

    const chatIds = Object.keys(chats);
    console.log(`Found ${chatIds.length} unique WhatsApp conversation sessions.`);

    let outputText = '=================================================================\n';
    outputText += ` GHOSTAGENT WHATSAPP CHATS EXPORT\n`;
    outputText += ` Export Date: ${new Date().toISOString()}\n`;
    outputText += ` Total Sessions: ${chatIds.length}\n`;
    outputText += '=================================================================\n\n';

    if (chatIds.length === 0) {
        outputText += 'No WhatsApp chat logs found in the activity_log table.\n';
        outputText += 'This is likely because no WhatsApp messages have been processed or logged in this database yet.\n\n';
    } else {
        for (const chatId of chatIds) {
            outputText += `=================================================================\n`;
            outputText += `CONVERSATION SESSION: WhatsApp (${chatId})\n`;
            outputText += `=================================================================\n\n`;

            for (const log of chats[chatId]) {
                const dateStr = new Date(log.timestamp).toISOString().replace('T', ' ').substring(0, 19);
                let sender = 'SYSTEM';
                let messageContent = '';

                if (log.event_type === 'INCOMING_MESSAGE') {
                    sender = `Customer (${chatId})`;
                    messageContent = log.metadata?.message || log.metadata?.text || log.description || '';
                    // Clean up message prefix from description if needed
                    if (messageContent.startsWith(`WhatsApp ${chatId}: `)) {
                        messageContent = messageContent.replace(`WhatsApp ${chatId}: `, '');
                    }
                } else if (log.event_type === 'AI_REPLY' || log.event_type === 'automation_v2') {
                    sender = 'Bot';
                    messageContent = log.metadata?.reply || log.metadata?.message || log.description || '';
                    if (messageContent.startsWith('Sent: "') && messageContent.endsWith('"')) {
                        messageContent = messageContent.slice(7, -1);
                    }
                } else if (log.event_type === 'DRAFT_REPLY') {
                    sender = 'Bot (Draft)';
                    messageContent = log.metadata?.reply_text || log.description || '';
                    if (messageContent.startsWith('Draft: "') && messageContent.endsWith('"')) {
                        messageContent = messageContent.slice(8, -1);
                    }
                } else {
                    sender = log.event_type;
                    messageContent = log.description || '';
                }

                outputText += `[${dateStr}] ${sender}: ${messageContent}\n`;
            }
            outputText += '\n\n';
        }
    }

    // 4. Fetch WhatsApp customer profiles as context/directory
    outputText += '=================================================================\n';
    outputText += ` WHATSAPP CUSTOMER DIRECTORY (CUSTOMER_PROFILES)\n`;
    outputText += '=================================================================\n';
    
    const { data: profiles, error: profError } = await supabase
        .from('customer_profiles')
        .select('*');

    if (profError) {
        console.error('Error fetching customer profiles:', profError);
    } else {
        const waProfiles = profiles?.filter(p => p.whatsapp_chat_id || p.phone) || [];
        outputText += `Total WhatsApp Customer Profiles: ${waProfiles.length}\n\n`;
        for (const p of waProfiles) {
            outputText += `- Name: ${p.name || 'Unknown'}\n`;
            outputText += `  Phone: ${p.phone || 'N/A'}\n`;
            outputText += `  WhatsApp Chat ID: ${p.whatsapp_chat_id || 'N/A'}\n`;
            outputText += `  Total Orders: ${p.total_orders || 0}\n`;
            outputText += `  Total Appointments: ${p.total_appointments || 0}\n`;
            outputText += `  Last Seen: ${p.last_seen || 'N/A'}\n\n`;
        }
    }

    const outputPath = 'whatsapp_chats_export.txt';
    fs.writeFileSync(outputPath, outputText, 'utf8');
    console.log(`Chat logs successfully exported to: ${path.resolve(outputPath)}`);
}

main().catch(console.error);
