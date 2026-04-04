content = open('src/app/page.tsx', 'r', encoding='utf-8').read()

old = "How does it know my inventory?', a: 'During setup, you can connect your Shopify, WooCommerce, or manually upload a simple CSV. Ghost Agent will sync stock levels in real-time and never sell items you don\u2019t have.'"
new  = "How does it know my inventory?', a: 'During setup, you add your products directly inside the GhostAgent dashboard \u2014 manually or via CSV. The AI reads your live product list and will never promote an item that is out of stock.'"

if old in content:
    print("FOUND - replacing")
    content = content.replace(old, new, 1)
    open('src/app/page.tsx', 'w', encoding='utf-8').write(content)
    print("DONE")
else:
    print("NOT FOUND")
