# How to Link the Connection Guide

Now that the `app/how-to-connect/page.tsx` page has been built, you will need to add links to it so your users can actually find it.

Here are the step-by-step instructions for adding the link to both your public `Navbar` and your internal dashboard `Sidebar`.

---

## 1. Add to the Public Landing Page Navbar

Open your `src/components/Navbar.tsx` file.

Find the `links` array near the top of the component (around line 15). Add the new Connection Guide link to this array:

```tsx
    const links = [
        { name: 'Features', href: '/#features', section: 'features' },
        { name: 'Pricing', href: '/#pricing', section: 'pricing' },
        { name: 'Connection Guide', href: '/how-to-connect', section: null }, // <--- ADD THIS LINE
        { name: 'About', href: '/about', section: null },
        { name: 'Contact', href: '/contact', section: null },
    ];
```

Because your Navbar is dynamically generated from this array, mapping over it and handling active states, adding it here will automatically update both the desktop navigation bar and the mobile drawer!

---

## 2. Add to the Internal Dashboard Sidebar

Open your `src/app/dashboard/layout.tsx` file.

First, import a new icon from `lucide-react` at the top of the file to represent the guide. We'll use the `BookOpen` icon.

```tsx
// Find line 4:
import { LayoutDashboard, MessageSquareText, Package, Settings, LogOut, CreditCard, Zap, ChevronRight, BookOpen } from 'lucide-react'; // <-- ADD BookOpen
```

Next, find the `navItems` array within the `DashboardSidebar` component (around line 29). Add the link to this list:

```tsx
    const navItems = [
        { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
        { icon: MessageSquareText, label: 'Live Chat', href: '/dashboard/interactions' },
        { icon: Package, label: 'Inventory', href: '/dashboard/inventory' },
        { icon: BookOpen, label: 'Connection Guide', href: '/how-to-connect' }, // <--- ADD THIS LINE
        { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
        { icon: CreditCard, label: 'Billing', href: '/dashboard/billing' },
    ];
```

Since the Sidebar logic maps through `navItems` automatically giving it the correct styling and active states, adding it here completely handles the sidebar integration!
