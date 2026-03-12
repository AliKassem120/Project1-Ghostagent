import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const workspaceId = searchParams.get('workspaceId');

    if (!id) {
        return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        let token = '';
        let isNewAPI = false;

        if (workspaceId) {
            const { data: integration } = await supabase
                .from('instagram_integrations')
                .select('access_token')
                .eq('workspace_id', workspaceId)
                .maybeSingle();

            if (integration?.access_token) {
                token = integration.access_token;
                isNewAPI = true;
            }
        }

        if (!token) {
            const { data: conn } = await supabase
                .from('user_connections')
                .select('access_token, metadata')
                .eq('user_id', user.id)
                .in('provider', ['INSTAGRAM', 'instagram_api_login'])
                .limit(1).maybeSingle();

            token = conn?.access_token || (conn as any)?.metadata?.access_token || '';
        }

        if (!token) {
            token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN || '';
        }

        if (!token) {
            return NextResponse.json({ error: 'Missing Access Token' }, { status: 500 });
        }

        // Sanitize Token
        token = token.trim();
        if (token.startsWith('"') && token.endsWith('"')) token = token.slice(1, -1);
        if (token.startsWith('{')) {
            try {
                const parsed = JSON.parse(token);
                token = parsed.access_token || token;
            } catch (e) { /* ignore */ }
        }

        const baseUrl = isNewAPI ? 'https://graph.instagram.com' : 'https://graph.facebook.com';
        const url = `${baseUrl}/v21.0/${id}?fields=name,username,profile_pic&access_token=${token}`;

        console.log(`🔍 [Profile API] Fetching from ${baseUrl} for ${id}`);
        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
            console.error('Instagram Profile Fetch Error:', data.error);
            return NextResponse.json({ error: data.error.message }, { status: 500 });
        }

        return NextResponse.json({
            name: data.name || data.username || 'Unknown User',
            username: data.username,
            profile_pic: data.profile_pic
        });

    } catch (error) {
        console.error('Profile API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
