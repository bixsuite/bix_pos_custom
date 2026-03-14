### Bix POS Custom

Custom POS extensions for [POSAwesome](https://github.com/yrestom/POS-Awesome).

### Features

**1. Customer Phone Number Uniqueness**
- Phone number is mandatory when creating or updating a customer from POS.
- Duplicate phone numbers are rejected (each phone number must be unique across customers).
- Customer names are allowed to be duplicated (multiple customers can share the same name).
- On update, the current customer is excluded from the uniqueness check.

**2. Item Code Auto-Add on Enter**
- When an alphanumeric item code (e.g. `INNAYA101`) is typed in the POS search field and Enter is pressed, if exactly one item matches, it is automatically added to the cart.
- The search field is cleared after adding, ready for the next scan/entry.
- Standard barcodes (UPC/EAN — pure numeric, 6–13 digits) are left to POSAwesome's native barcode handler.
- Works with both card view and table/list view (default).

### Requirements

- [POSAwesome](https://github.com/yrestom/POS-Awesome)

### Installation

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
