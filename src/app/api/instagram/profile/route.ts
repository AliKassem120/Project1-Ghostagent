import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }

    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;
    if (!token) {
        return NextResponse.json({ error: 'Missing Access Token' }, { status: 500 });
    }

    try {
        // Fetch public profile info given the ASID (App Scoped ID)
        // Note: For Instagram Messaging, the sender ID is an IGSID.
        // We can try fetching basic fields.
        const url = `https://graph.facebook.com/v21.0/${id}?fields=name,username,profile_pic&access_token=${token}`;

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
