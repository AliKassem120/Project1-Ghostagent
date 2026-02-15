'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Trash2, Save, X, Package, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/contexts/ToastContext';
import GhostModal from '@/components/GhostModal';
import { useRealtime } from '@/hooks/useRealtime';

// Database row type
type InventoryRow = {
    id: string;
    user_id: string;
    item_name: string;
    price: number;
    stock_level: number;
    created_at: string;
};

// UI display type
type Product = {
    id: string;
    name: string;
    price: number;
    stock: number;
    status: 'In Stock' | 'Out of Stock';
};

export default function InventoryPage() {
    const supabase = createClient();
    const toast = useToast();
    const [userId, setUserId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [newProduct, setNewProduct] = useState({ name: '', price: 0, stock: 0 });
    const [deleteModal, setDeleteModal] = useState<{ open: boolean; productId: string | null; productName: string }>({ open: false, productId: null, productName: '' });

    // Get user ID on mount
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUserId(user.id);
        };
        getUser();
    }, []);

    // 🔥 REALTIME: Subscribe to inventory changes
    const { data: inventoryData, loading } = useRealtime<InventoryRow>(
        'inventory',
        '*',
        {
            filter: userId ? { column: 'user_id', value: userId } : undefined,
            orderBy: 'created_at',
            orderDirection: 'desc',
            enabled: !!userId,
            onInsert: (item) => {
                toast.ghost('Inventory Updated', { description: `"${item.item_name}" was added.` });
            },
            onDelete: (item) => {
                toast.info('Item Removed', { description: `"${item.item_name}" was deleted.` });
            },
        }
    );

    // Transform database rows to UI products
    const products: Product[] = inventoryData.map(item => ({
        id: item.id,
        name: item.item_name,
        price: item.price,
        stock: item.stock_level,
        status: item.stock_level > 0 ? 'In Stock' : 'Out of Stock'
    }));

    const handleAddClick = () => {
        setIsAdding(true);
        setNewProduct({ name: '', price: 0, stock: 0 });
    };

    const handleCancelAdd = () => {
        setIsAdding(false);
    };

    const handleSaveProduct = async () => {
        if (!newProduct.name || !userId) return;

        try {
            const stock = Number(newProduct.stock) || 0;
            const price = Number(newProduct.price) || 0;

            const { data, error } = await supabase
                .from('inventory')
                .insert({
                    user_id: userId,
                    item_name: newProduct.name,
                    price: price,
                    stock_level: stock,
                })
                .select()
                .single();

            if (error) throw error;

            if (data) {
                // Log activity (will trigger toast via RealtimeProvider)
                await supabase.from('activity_log').insert({
                    user_id: userId,
                    event_type: 'INVENTORY_ADD',
                    description: `Added "${data.item_name}" to stock`,
                    timestamp: new Date().toISOString()
                });

                // ✅ NO MANUAL STATE UPDATE - Realtime hook handles it!
                setIsAdding(false);
                setNewProduct({ name: '', price: 0, stock: 0 });
                toast.success('Product Added', { description: `"${data.item_name}" is now in your inventory.` });
            }
        } catch (error) {
            console.error('Error saving product:', error);
            toast.error('Failed to save product. Check console.');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase
                .from('inventory')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // ✅ NO MANUAL STATE UPDATE - Realtime hook handles it!
            toast.success('Product Deleted');
        } catch (error) {
            console.error('Error deleting product:', error);
            toast.error('Failed to delete product.');
        }
    };

    const openDeleteModal = (product: Product) => {
        setDeleteModal({ open: true, productId: product.id, productName: product.name });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-3xl font-bold">Inventory</h1>
                <button
                    onClick={handleAddClick}
                    disabled={isAdding}
                    className="w-full sm:w-auto px-6 py-3 bg-primary text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(192,132,252,0.3)] active:scale-95"
                >
                    <Plus className="w-5 h-5" /> Add Product
                </button>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                    type="text"
                    placeholder="Search products..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-primary/50 transition-all text-lg lg:text-base glass"
                />
            </div>

            <div className="space-y-4">
                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4">
                    {isAdding && (
                        <div className="glass-dark p-6 rounded-3xl border border-primary/30 animate-in fade-in slide-in-from-top-4 space-y-4 shadow-[0_0_30px_rgba(192,132,252,0.1)]">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-primary/60 uppercase">Product Name</label>
                                <input
                                    autoFocus
                                    className="bg-white/5 border border-white/10 rounded-xl w-full px-4 py-3 focus:outline-none focus:border-primary transition-colors text-lg"
                                    placeholder="Enter name..."
                                    value={newProduct.name}
                                    onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-primary/60 uppercase">Price (USD)</label>
                                    <input
                                        type="number"
                                        className="bg-white/5 border border-white/10 rounded-xl w-full px-4 py-3 focus:outline-none focus:border-primary transition-colors text-lg"
                                        placeholder="0.00"
                                        value={newProduct.price}
                                        onChange={e => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-primary/60 uppercase">Stock</label>
                                    <input
                                        type="number"
                                        className="bg-white/5 border border-white/10 rounded-xl w-full px-4 py-3 focus:outline-none focus:border-primary transition-colors text-lg"
                                        placeholder="0"
                                        value={newProduct.stock}
                                        onChange={e => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={handleSaveProduct} className="flex-1 py-3 bg-primary text-black font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                                    <Save className="w-5 h-5" /> Save Item
                                </button>
                                <button onClick={handleCancelAdd} className="px-4 py-3 bg-white/5 text-white/60 rounded-xl hover:bg-white/10 transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                    )}

                    {products.map((item) => (
                        <div key={item.id} className="glass-dark p-5 rounded-3xl border border-white/10 active:border-primary/30 transition-all space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-xl">{item.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={clsx(
                                            "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                                            item.stock > 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                        )}>
                                            {item.status}
                                        </span>
                                        <span className="text-sm text-white/40 font-medium">#{item.id.toString().slice(-4)}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => openDeleteModal(item)}
                                    className="p-2 text-white/20 hover:text-red-400 active:bg-red-500/10 rounded-xl transition-all"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Price</p>
                                    <p className="text-xl font-black text-primary">${item.price.toFixed(2)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Stock Level</p>
                                    <p className="text-xl font-black text-white">{item.stock}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block glass-dark rounded-3xl overflow-hidden border border-white/10">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-white/60 text-xs uppercase tracking-widest">
                            <tr>
                                <th className="p-6 font-bold">Product</th>
                                <th className="p-6 font-bold">Price (USD)</th>
                                <th className="p-6 font-bold">Stock</th>
                                <th className="p-6 font-bold">Status</th>
                                <th className="p-6 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isAdding && (
                                <tr className="bg-primary/5 animate-in fade-in slide-in-from-top-2">
                                    <td className="p-6">
                                        <input
                                            autoFocus
                                            className="bg-transparent border-b border-white/20 w-full focus:outline-none focus:border-primary px-2 py-1"
                                            placeholder="Product Name"
                                            value={newProduct.name}
                                            onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                                        />
                                    </td>
                                    <td className="p-6">
                                        <input
                                            type="number"
                                            className="bg-transparent border-b border-white/20 w-24 focus:outline-none focus:border-primary px-2 py-1"
                                            placeholder="0.00"
                                            value={newProduct.price}
                                            onChange={e => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) })}
                                        />
                                    </td>
                                    <td className="p-6">
                                        <input
                                            type="number"
                                            className="bg-transparent border-b border-white/20 w-20 focus:outline-none focus:border-primary px-2 py-1"
                                            placeholder="0"
                                            value={newProduct.stock}
                                            onChange={e => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) })}
                                        />
                                    </td>
                                    <td className="p-6 text-white/40 text-sm italic">
                                        Auto-calculated
                                    </td>
                                    <td className="p-6 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={handleSaveProduct} className="p-2 hover:bg-green-500/20 text-green-400 rounded-lg transition-colors">
                                                <Save className="w-4 h-4" />
                                            </button>
                                            <button onClick={handleCancelAdd} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {products.map((item) => (
                                <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="p-6 font-medium text-lg">{item.name}</td>
                                    <td className="p-6 text-white/80 font-bold">${item.price.toFixed(2)}</td>
                                    <td className="p-6 text-white/80">{item.stock}</td>
                                    <td className="p-6">
                                        <span className={clsx(
                                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                                            item.stock > 0 ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                                        )}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="p-6 text-right">
                                        <button
                                            onClick={() => openDeleteModal(item)}
                                            className="text-white/20 hover:text-red-400 transition-all p-2 hover:bg-red-500/10 rounded-xl"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {products.length === 0 && !isAdding && !loading && (
                    <div className="flex flex-col items-center justify-center py-24 text-center opacity-70">
                        <div className="relative w-24 h-24 mb-6">
                            <motion.div
                                animate={{ rotateX: 360, rotateY: 360, rotateZ: 360 }}
                                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                className="w-16 h-16 border border-primary/30 relative mx-auto mt-4"
                                style={{ transformStyle: 'preserve-3d' }}
                            >
                                <div className="absolute inset-0 border border-primary/20 translate-z-8" style={{ transform: 'translateZ(32px)' }} />
                                <div className="absolute inset-0 border border-primary/20 -translate-z-8" style={{ transform: 'translateZ(-32px)' }} />
                                <div className="absolute inset-0 border border-primary/20" style={{ transform: 'rotateY(90deg) translateZ(32px)' }} />
                                <div className="absolute inset-0 border border-primary/20" style={{ transform: 'rotateY(90deg) translateZ(-32px)' }} />
                                <div className="absolute inset-0 border border-primary/20" style={{ transform: 'rotateX(90deg) translateZ(32px)' }} />
                                <div className="absolute inset-0 border border-primary/20" style={{ transform: 'rotateX(90deg) translateZ(-32px)' }} />
                            </motion.div>
                        </div>
                        <div className="text-white/30 text-sm">
                            No items yet. Add your first product.
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            <GhostModal
                isOpen={deleteModal.open}
                variant="danger"
                title="Delete Product?"
                message={<>Are you sure you want to delete <span className="font-bold text-white">"{deleteModal.productName}"</span>? This action cannot be undone.</>}
                confirmText="Delete"
                cancelText="Keep It"
                onConfirm={() => {
                    if (deleteModal.productId) {
                        handleDelete(deleteModal.productId);
                    }
                }}
                onCancel={() => setDeleteModal({ open: false, productId: null, productName: '' })}
            />
        </div>
    );
}
