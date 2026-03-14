### Bix POS Custom

Custom POS extensions for [POSAwesome](https://github.com/yrestom/POS-Awesome).

### Features

**1. Customer Phone Number Uniqueness**
- Phone number is mandatory when creating or updating a customer from POS.
- Duplicate phone numbers are rejected across all customers.
- Duplicate customer names are allowed.

**2. Item Code Auto-Add on Enter**
- Type an alphanumeric item code in the search field and press Enter — if exactly one item matches, it is automatically added to the cart and the search field is cleared.
- Standard barcodes (UPC/EAN) are handled natively by POSAwesome.
- Works with both card view and table/list view.

### Installation

Requires [POSAwesome](https://github.com/yrestom/POS-Awesome) to be installed.

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app https://github.com/bixsuite/bix_pos_custom.git --branch develop
bench --site YOUR_SITE install-app bix_pos_custom
bench --site YOUR_SITE migrate
bench --site YOUR_SITE clear-cache
bench restart
```

### License

MIT
