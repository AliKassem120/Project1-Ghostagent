"use client";

import React, { useState } from 'react';
import {
    ShoppingBag,
    Calendar,
    Home,
    UtensilsCrossed,
    PartyPopper,
    Laptop
} from 'lucide-react';

export type BusinessCategory =
    | 'ecommerce'
    | 'appointments'
    | 'real_estate'
    | 'food_and_beverage'
    | 'nightlife_events'
    | 'digital_services';

interface BusinessTypeSelectorProps {
    value?: BusinessCategory;
    onChange: (category: BusinessCategory) => void;
    isLoading?: boolean;
}

const CATEGORIES = [
    {
        id: 'ecommerce',
        label: 'E-commerce',
        description: 'Physical products, shipping, inventory',
        icon: ShoppingBag,
    },
    {
        id: 'appointments',
        label: 'Appointments',
        description: 'Services, bookings, calendar',
        icon: Calendar,
    },
    {
        id: 'real_estate',
        label: 'Real Estate',
        description: 'Properties, budgets, viewings',
        icon: Home,
    },
    {
        id: 'food_and_beverage',
        label: 'Food & Beverage',
        description: 'Restaurants, menus, delivery',
        icon: UtensilsCrossed,
    },
    {
        id: 'nightlife_events',
        label: 'Nightlife & Events',
        description: 'Tickets, VIP tables, guest lists',
        icon: PartyPopper,
    },
    {
        id: 'digital_services',
        label: 'Digital Services',
        description: 'Downloads, tech support, consulting',
        icon: Laptop,
    },
] as const;

export default function BusinessTypeSelector({
    value = 'ecommerce',
    onChange,
    isLoading = false
}: BusinessTypeSelectorProps) {
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    const handleSelect = (id: BusinessCategory) => {
        if (!isLoading) {
            onChange(id);
        }
    };

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-medium text-slate-200">Business Niche</h3>
                    <p className="text-xs text-slate-400 mt-1">
                        Ghost Agent adapts its AI behavior based on your industry.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {CATEGORIES.map((category) => {
                    const Icon = category.icon;
                    const isSelected = value === category.id;
                    const isHovered = hoveredId === category.id;

                    return (
                        <div
                            key={category.id}
                            onClick={() => handleSelect(category.id as BusinessCategory)}
                            onMouseEnter={() => setHoveredId(category.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            className={`
                relative flex flex-col items-start p-4 rounded-xl cursor-pointer
                transition-all duration-300 ease-in-out border
                ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                ${isSelected
                                    ? 'bg-slate-800/80 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                                }
              `}
                        >
                            {/* Active Indicator Pulse (Optional micro-animation when selected) */}
                            {isSelected && (
                                <div className="absolute top-4 right-4 h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                                </div>
                            )}

                            <div className={`p-2 rounded-lg mb-3 transition-colors duration-300 ${isSelected
                                    ? 'bg-purple-500/20 text-purple-400'
                                    : isHovered
                                        ? 'bg-slate-800 text-slate-300'
                                        : 'bg-slate-800/50 text-slate-400'
                                }`}>
                                <Icon size={20} strokeWidth={isSelected ? 2.5 : 2} />
                            </div>

                            <h4 className={`text-sm font-medium mb-1 transition-colors ${isSelected ? 'text-purple-300' : 'text-slate-200'
                                }`}>
                                {category.label}
                            </h4>

                            <p className="text-xs text-slate-500 leading-relaxed text-left">
                                {category.description}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
