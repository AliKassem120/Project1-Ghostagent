'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Trash2, Save, X, Package, Loader2, DollarSign, Box, TrendingUp, AlertTriangle, Edit2 } from 'lucide-react';
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
    const [searchQuery, setSearchQuery] = useState('');
    const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: '' });
    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState({ name: '', price: '', stock: '' });
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

    // Filtered products
    const filteredProducts = useMemo(() => {
        if (!searchQuery.trim()) return products;
        return products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [products, searchQuery]);

    // Summary stats
    const summaryStats = useMemo(() => {
        const totalItems = products.length;
        const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
        const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
        const lowStock = products.filter(p => p.stock > 0 && p.stock <= 5).length;
        const outOfStock = products.filter(p => p.stock === 0).length;
        return { totalItems, totalValue, totalStock, lowStock, outOfStock };
    }, [products]);

    const handleAddClick = () => {
        setIsAdding(true);
        setNewProduct({ name: '', price: '', stock: '' });
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
                await supabase.from('activity_log').insert({
                    user_id: userId,
                    event_type: 'INVENTORY_ADD',
                    description: `Added "${data.item_name}" to stock`,
                    timestamp: new Date().toISOString()
                });

                setIsAdding(false);
                setNewProduct({ name: '', price: '', stock: '' });
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
            toast.success('Product Deleted');
        } catch (error) {
            console.error('Error deleting product:', error);
            toast.error('Failed to delete product.');
        }
    };

    const handleEditClick = (product: Product) => {
        setEditingProductId(product.id);
        setEditValues({ name: product.name, price: product.price.toString(), stock: product.stock.toString() });
    };

    const handleCancelEdit = () => {
        setEditingProductId(null);
    };

    const handleSaveEdit = async () => {
        if (!editingProductId || !userId || !editValues.name.trim()) return;

        try {
            const stock = Number(editValues.stock) || 0;
            const price = Number(editValues.price) || 0;

            const { error } = await supabase
                .from('inventory')
                .update({
                    item_name: editValues.name,
                    price: price,
                    stock_level: stock,
                })
                .eq('id', editingProductId);

            if (error) throw error;
            toast.success('Product Updated');
            setEditingProductId(null);
        } catch (error) {
            console.error('Error updating product:', error);
            toast.error('Failed to update product.');
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
        <div className="space-y-6 pb-6 md:pb-8">

            {/* ═══ HEADER ═══ */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Inventory</h1>
                    <p className="text-sm text-muted-foreground mt-1">Manage your product catalog and stock levels.</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleAddClick}
                    disabled={isAdding}
                    className="w-full sm:w-auto px-6 py-3 bg-primary text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] active:scale-95"
                >
                    <Plus className="w-5 h-5" /> Add Product
                </motion.button>
            </motion.div>

            {/* ═══ SUMMARY CARDS ═══ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { icon: Package, label: 'Total Products', value: summaryStats.totalItems, color: 'text-violet-400', bg: 'bg-violet-500/10' },
                    { icon: Box, label: 'Total Stock', value: summaryStats.totalStock, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { icon: DollarSign, label: 'Inventory Value', value: `$${summaryStats.totalValue.toFixed(0)}`, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { icon: AlertTriangle, label: 'Low / Out of Stock', value: `${summaryStats.lowStock + summaryStats.outOfStock}`, color: summaryStats.outOfStock > 0 ? 'text-red-400' : 'text-amber-400', bg: summaryStats.outOfStock > 0 ? 'bg-red-500/10' : 'bg-amber-500/10' },
                ].map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 + i * 0.05 }}
                        className="bg-surface-1 border border-border shadow-sm rounded-2xl p-5"
                    >
                        <div className={clsx("p-2 rounded-xl w-fit mb-3", stat.bg)}>
                            <stat.icon className={clsx("w-4 h-4", stat.color)} />
                        </div>
                        <div className="text-xl font-bold text-foreground tracking-tight">{stat.value}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</div>
                    </motion.div>
                ))}
            </div>

            {/* ═══ SEARCH ═══ */}
            <div className="relative mb-6">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search products..."
                    className="input-premium w-full !pl-10"
                />
            </div>

            {/* ═══ ADD PRODUCT FORM ═══ */}
            <AnimatePresence>
                {isAdding && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="bg-surface-1 border border-border shadow-sm rounded-2xl p-6 border-2 border-primary/20 space-y-5">
                            <div className="flex items-center gap-3 pb-4 border-b border-white/[0.04]">
                                <div className="p-2 rounded-xl bg-primary/10">
                                    <Plus className="w-4 h-4 text-primary" />
                                </div>
                                <h3 className="font-bold text-foreground">New Product</h3>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-1.5 sm:col-span-1">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Product Name</label>
                                    <input
                                        autoFocus
                                        className="input-premium w-full"
                                        placeholder="e.g. Vintage T-Shirt"
                                        value={newProduct.name}
                                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveProduct(); }}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Price (USD)</label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">$</span>
                                        <input
                                            type="number"
                                            className="input-premium w-full pl-8 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none m-0"
                                            placeholder="0.00"
                                            value={newProduct.price}
                                            onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Stock Qty</label>
                                    <input
                                        type="number"
                                        className="input-premium w-full appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none m-0"
                                        placeholder="0"
                                        value={newProduct.stock}
                                        onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleSaveProduct}
                                    disabled={!newProduct.name.trim()}
                                    className="flex-1 sm:flex-none px-8 py-3 bg-primary text-black font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                                >
                                    <Save className="w-4 h-4" /> Save Product
                                </button>
                                <button
                                    onClick={handleCancelAdd}
                                    className="px-4 py-3 bg-surface-2 text-muted-foreground rounded-xl hover:bg-surface-2 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ PRODUCT LIST ═══ */}
            <div className="space-y-3">
                {/* Mobile Cards */}
                <div className="lg:hidden space-y-3">
                    {filteredProducts.map((item, i) => {
                        const isEditing = editingProductId === item.id;
                        return (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.03 }}
                                className="bg-surface-1 border border-border shadow-sm rounded-2xl p-5 group"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3 w-full">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <Package className="w-5 h-5 text-primary/70" />
                                        </div>
                                        <div className="flex-1">
                                            {isEditing ? (
                                                <input
                                                    className="input-premium py-1 px-3 w-full text-base font-bold mb-1"
                                                    value={editValues.name}
                                                    onChange={e => setEditValues({ ...editValues, name: e.target.value })}
                                                />
                                            ) : (
                                                <h3 className="font-bold text-foreground text-base">{item.name}</h3>
                                            )}
                                            <span className={clsx(
                                                "text-[10px] font-bold uppercase tracking-wider",
                                                item.stock > 5 ? "text-emerald-400" : item.stock > 0 ? "text-amber-400" : "text-red-400"
                                            )}>
                                                {item.stock > 5 ? 'In Stock' : item.stock > 0 ? 'Low Stock' : 'Out of Stock'}
                                            </span>
                                        </div>
                                    </div>
                                    {isEditing ? (
                                        <div className="flex items-center gap-1 shrink-0 ml-2">
                                            <button onClick={handleSaveEdit} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all">
                                                <Save className="w-4 h-4" />
                                            </button>
                                            <button onClick={handleCancelEdit} className="p-2 text-muted-foreground hover:bg-surface-2 rounded-xl transition-all">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 shrink-0 ml-2">
                                            <button onClick={() => handleEditClick(item)} className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => openDeleteModal(item)}
                                                className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/[0.04]">
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Price</p>
                                        {isEditing ? (
                                            <div className="relative w-full">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">$</span>
                                                <input
                                                    type="number"
                                                    className="input-premium py-1.5 pl-8 pr-2 w-full text-base font-bold appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none m-0"
                                                    value={editValues.price}
                                                    onChange={e => setEditValues({ ...editValues, price: e.target.value })}
                                                />
                                            </div>
                                        ) : (
                                            <p className="text-lg font-bold text-emerald-400">${item.price.toFixed(2)}</p>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Stock</p>
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                className="input-premium py-1.5 px-3 w-full text-base font-bold appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none m-0"
                                                value={editValues.stock}
                                                onChange={e => setEditValues({ ...editValues, stock: e.target.value })}
                                            />
                                        ) : (
                                            <p className="text-lg font-bold text-foreground">{item.stock}</p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Desktop Table */}
                <div className="hidden lg:block bg-surface-1 border border-border shadow-sm rounded-2xl overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/[0.04]">
                                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Product</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Price</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Stock</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                            {filteredProducts.map((item) => {
                                const isEditing = editingProductId === item.id;
                                return (
                                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                    <Package className="w-4 h-4 text-primary/60" />
                                                </div>
                                                {isEditing ? (
                                                    <input
                                                        className="input-premium py-1 px-3 w-40 text-sm font-semibold"
                                                        value={editValues.name}
                                                        onChange={e => setEditValues({ ...editValues, name: e.target.value })}
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <span className="font-semibold text-foreground text-sm">{item.name}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {isEditing ? (
                                                <div className="relative w-28">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-semibold">$</span>
                                                    <input
                                                        type="number"
                                                        className="input-premium py-1 pl-7 pr-2 w-full text-sm font-semibold appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none m-0"
                                                        value={editValues.price}
                                                        onChange={e => setEditValues({ ...editValues, price: e.target.value })}
                                                    />
                                                </div>
                                            ) : (
                                                <span className="font-semibold text-emerald-400 text-sm">${item.price.toFixed(2)}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    className="input-premium py-1 px-3 w-20 text-sm font-semibold appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none m-0"
                                                    value={editValues.stock}
                                                    onChange={e => setEditValues({ ...editValues, stock: e.target.value })}
                                                />
                                            ) : (
                                                <span className="text-sm text-muted-foreground font-medium">{item.stock}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={clsx(
                                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                                item.stock > 5 ? "bg-emerald-500/10 text-emerald-400" : item.stock > 0 ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"
                                            )}>
                                                <span className={clsx("w-1.5 h-1.5 rounded-full", item.stock > 5 ? "bg-emerald-400" : item.stock > 0 ? "bg-amber-400" : "bg-red-400")} />
                                                {item.stock > 5 ? 'In Stock' : item.stock > 0 ? 'Low Stock' : 'Out of Stock'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {isEditing ? (
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button onClick={handleSaveEdit} className="text-emerald-400/80 hover:text-emerald-400 p-1.5 hover:bg-emerald-500/10 rounded-lg transition-all" title="Save">
                                                        <Save className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={handleCancelEdit} className="text-muted-foreground hover:text-muted-foreground p-1.5 hover:bg-surface-2 rounded-lg transition-all" title="Cancel">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEditClick(item)} className="text-muted-foreground hover:text-primary/80 transition-all p-2 hover:bg-primary/10 rounded-lg" title="Edit">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => openDeleteModal(item)}
                                                        className="text-muted-foreground hover:text-red-400 transition-all p-2 hover:bg-red-500/10 rounded-lg" title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Empty State */}
                {filteredProducts.length === 0 && !isAdding && !loading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-32 text-center relative"
                    >
                        {/* Background subtle glow */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-primary/20 rounded-full blur-[80px] pointer-events-none" />

                        <motion.div
                            animate={{ y: [0, -12, 0] }}
                            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                            className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(139,92,246,0.15)] backdrop-blur-md"
                        >
                            <Package className="w-10 h-10 text-primary/60" />
                        </motion.div>
                        <h3 className="text-foreground text-lg font-bold tracking-tight mb-2 relative z-10">
                            {searchQuery ? 'No products match your search' : 'No products yet'}
                        </h3>
                        <p className="text-muted-foreground text-sm relative z-10">
                            {searchQuery ? 'Try a different search term' : 'Click "Add Product" to start building your catalog'}
                        </p>
                    </motion.div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            <GhostModal
                isOpen={deleteModal.open}
                variant="danger"
                title="Delete Product?"
                message={<>Are you sure you want to delete <span className="font-bold text-foreground">&quot;{deleteModal.productName}&quot;</span>? This action cannot be undone.</>}
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
