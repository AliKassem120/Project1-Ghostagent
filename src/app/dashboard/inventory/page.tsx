'use client';

import { useState } from 'react';
import { Plus, Search, Trash2, Save, X, Package } from 'lucide-react';
import { clsx } from 'clsx';

type Product = {
    id: number;
    name: string;
    price: number;
    stock: number;
    status: 'In Stock' | 'Out of Stock';
};

const INITIAL_INVENTORY: Product[] = [
    { id: 1, name: 'Neon Ghost Light', price: 49.99, stock: 12, status: 'In Stock' },
    { id: 2, name: 'Phantom Hoodie', price: 85.00, stock: 45, status: 'In Stock' },
    { id: 3, name: 'Ectoplasm Lamp', price: 120.00, stock: 0, status: 'Out of Stock' },
];

export default function InventoryPage() {
    const [products, setProducts] = useState<Product[]>(INITIAL_INVENTORY);
    const [isAdding, setIsAdding] = useState(false);
    const [newProduct, setNewProduct] = useState<Partial<Product>>({ name: '', price: 0, stock: 0 });

    const handleAddClick = () => {
        setIsAdding(true);
        setNewProduct({ name: '', price: 0, stock: 0 });
    };

    const handleCancelAdd = () => {
        setIsAdding(false);
    };

    const handleSaveProduct = () => {
        if (!newProduct.name) return;

        const stock = Number(newProduct.stock) || 0;
        const price = Number(newProduct.price) || 0;

        const product: Product = {
            id: Date.now(),
            name: newProduct.name,
            price: price,
            stock: stock,
            status: stock > 0 ? 'In Stock' : 'Out of Stock'
        };

        setProducts(prev => [product, ...prev]);
        setIsAdding(false);
    };

    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this ghost item?')) {
            setProducts(prev => prev.filter(p => p.id !== id));
        }
    };

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
                                    onClick={() => handleDelete(item.id)}
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
                                            onClick={() => handleDelete(item.id)}
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

                {products.length === 0 && !isAdding && (
                    <div className="glass-dark p-20 rounded-3xl border border-white/10 text-center space-y-4">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                            <Package className="w-10 h-10 text-white/20" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-xl font-bold">No items found</h3>
                            <p className="text-white/40">Your ghost inventory is currently empty.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
