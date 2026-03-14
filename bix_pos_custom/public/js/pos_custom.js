/**
 * bix_pos_custom — POS extensions (v4)
 *
 * Features:
 * 1. Item code auto-add on Enter (barcode vs item code detection)
 * 2. Drafts dialog: search field + phone number column
 */
(function () {
	"use strict";

	var DEBUG = true;

	function log() {
		if (!DEBUG) return;
		var args = Array.prototype.slice.call(arguments);
		args.unshift("[bix_pos_custom]");
		console.log.apply(console, args);
	}

	log("Script loaded");

	/* ------------------------------------------------------------------ */

	/**
	 * Pure numeric, 6–13 digits → likely UPC-A/EAN-13/EAN-8.
	 * Let posawesome handle these natively (its barcode matching works).
	 */
	function isBarcode(query) {
		return /^\d{6,13}$/.test(query);
	}

	function getShell() {
		return document.querySelector(".items-selector-shell");
	}

	/* ------------------------------------------------------------------ */

	/**
	 * Clear the search input via DOM.
	 * Sets value to "" and dispatches 'input' event so Vue's v-model updates.
	 */
	function clearSearch() {
		var shell = getShell();
		if (!shell) return;
		var inputs = Array.prototype.slice
			.call(shell.querySelectorAll("input"))
			.filter(function (i) { return i.type !== "hidden"; });
		if (inputs[0]) {
			inputs[0].value = "";
			inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
			inputs[0].focus();
			log("Search cleared");
		}
	}

	/**
	 * Find the single displayed item element — works in both views:
	 *   Card view: .card-item-card
	 *   Table view: <tr> in .items-table-container tbody (excluding no-data rows)
	 *
	 * Returns { el: HTMLElement, count: number } or { el: null, count: number }
	 */
	function findItems() {
		var shell = getShell();
		if (!shell) return { el: null, count: 0 };

		/* --- Card view --- */
		var cards = shell.querySelectorAll(".card-item-card");
		if (cards.length > 0) {
			return { el: cards.length === 1 ? cards[0] : null, count: cards.length };
		}

		/* --- Table view (default) --- */
		var rows = shell.querySelectorAll(".items-table-container tbody tr");
		var dataRows = [];
		for (var i = 0; i < rows.length; i++) {
			/* Vuetify renders "No items found" as <td colspan="..."> — skip those */
			if (!rows[i].querySelector("td[colspan]")) {
				dataRows.push(rows[i]);
			}
		}
		return {
			el: dataRows.length === 1 ? dataRows[0] : null,
			count: dataRows.length,
		};
	}

	/* ------------------------------------------------------------------ */

	var _pollTimer = null;

	function tryAddSingleItem(attempt) {
		if (attempt >= 10) {
			log("Gave up after " + attempt + " attempts");
			return;
		}

		var result = findItems();
		log("Poll #" + (attempt + 1) + " — items found:", result.count);

		if (result.el) {
			log("Single item — clicking");
			result.el.click();
			setTimeout(clearSearch, 200);
			return;
		}

		if (result.count > 1) {
			log("Multiple items (" + result.count + ") — not auto-adding");
			return;
		}

		/* 0 items — search may still be loading (limit search / server). Retry. */
		_pollTimer = setTimeout(function () {
			tryAddSingleItem(attempt + 1);
		}, 250);
	}

	/* ------------------------------------------------------------------ */

	var _attached = false;

	function onKeydown(e) {
		if (e.key !== "Enter") return;

		var shell = getShell();
		if (!shell) return;

		var target = e.target || document.activeElement;
		if (!shell.contains(target)) return;
		if (target.tagName !== "INPUT" || target.type === "hidden") return;

		/* Only act on the search input (first visible input), not QTY */
		var visibleInputs = Array.prototype.slice
			.call(shell.querySelectorAll("input"))
			.filter(function (i) { return i.type !== "hidden"; });
		if (visibleInputs.indexOf(target) !== 0) return;

		var query = (target.value || "").trim();
		if (!query) return;

		/* Barcodes (UPC/EAN): let posawesome handle natively */
		if (isBarcode(query)) {
			log("Barcode (" + query + ") — posawesome handles");
			return;
		}

		log("Item code (" + query + ") — will poll for single match");

		/* Cancel any previous poll */
		if (_pollTimer) {
			clearTimeout(_pollTimer);
			_pollTimer = null;
		}

		/*
		 * Let posawesome's Enter handler run (don't stopPropagation).
		 * It calls _performSearch() which:
		 * - Non-limit-search: items already reactive, just triggers enter_event
		 *   (which errors on non-barcode items but doesn't affect state)
		 * - Limit search: runs server-side search, updates items
		 *
		 * Start polling after 300ms to give posawesome's search time to complete.
		 */
		_pollTimer = setTimeout(function () {
			tryAddSingleItem(0);
		}, 300);
	}

	function attach() {
		if (_attached) return;
		_attached = true;
		document.addEventListener("keydown", onKeydown, true);
		log("Listener attached");
	}

	function detach() {
		if (!_attached) return;
		_attached = false;
		document.removeEventListener("keydown", onKeydown, true);
		if (_pollTimer) {
			clearTimeout(_pollTimer);
			_pollTimer = null;
		}
	}

	var _observer = new MutationObserver(function () {
		if (getShell()) {
			attach();
		} else {
			detach();
		}
		/* Drafts dialog enhancements */
		enhanceDraftsDialog();
		injectDraftsPhoneColumn();
	});

	_observer.observe(document.body, { childList: true, subtree: true });

	if (getShell()) {
		attach();
	}

	/* ================================================================== */
	/*  FEATURE 3: Drafts dialog — search field + phone column            */
	/* ================================================================== */

	var _draftsSearchInjected = false;

	function enhanceDraftsDialog() {
		var card = document.querySelector(".drafts-dialog-card");
		if (!card) {
			_draftsSearchInjected = false;
			return;
		}
		if (_draftsSearchInjected) return;
		_draftsSearchInjected = true;

		/* Inject search input after the title */
		var body = card.querySelector(".drafts-dialog-card__body");
		if (!body) return;

		var searchWrap = document.createElement("div");
		searchWrap.style.cssText = "padding:4px 16px 8px;";
		searchWrap.innerHTML =
			'<input type="text" placeholder="Search invoices\u2026" ' +
			'style="width:100%;padding:10px 14px;border:1px solid rgba(128,128,128,0.3);' +
			'border-radius:10px;font-size:0.95rem;outline:none;background:transparent;' +
			'color:inherit;" />';
		body.parentNode.insertBefore(searchWrap, body);

		var searchInput = searchWrap.querySelector("input");
		searchInput.addEventListener("input", function () {
			filterDrafts(card, this.value);
		});
		searchInput.focus();
		log("Drafts search injected");
	}

	function filterDrafts(card, query) {
		var needle = (query || "").trim().toLowerCase();

		/* Table view: filter <tr> rows */
		var rows = card.querySelectorAll(".drafts-dialog-table tbody tr");
		for (var i = 0; i < rows.length; i++) {
			var text = (rows[i].textContent || "").toLowerCase();
			rows[i].style.display = !needle || text.indexOf(needle) !== -1 ? "" : "none";
		}

		/* Compact/mobile view: filter button items */
		var items = card.querySelectorAll(".drafts-dialog-item");
		for (var j = 0; j < items.length; j++) {
			var txt = (items[j].textContent || "").toLowerCase();
			items[j].style.display = !needle || txt.indexOf(needle) !== -1 ? "" : "none";
		}
	}

	/* --- Phone column injection (table + compact views) --- */

	var _draftsPhoneMap = {};
	var _phoneFetchDone = false;

	function injectDraftsPhoneColumn() {
		var card = document.querySelector(".drafts-dialog-card");
		if (!card) {
			_phoneFetchDone = false;
			_draftsPhoneMap = {};
			return;
		}

		/* Table view */
		var table = card.querySelector(".drafts-dialog-table");
		if (table) {
			_injectPhoneHeader(table);

			/* Collect invoice names from rows that haven't been enhanced yet */
			var rows = table.querySelectorAll("tbody tr");
			var needsFetch = false;
			var invoiceNames = [];
			for (var i = 0; i < rows.length; i++) {
				if (rows[i].querySelector(".bix-phone-cell")) continue;
				var tds = rows[i].querySelectorAll("td");
				if (tds.length < 6) continue;
				needsFetch = true;
				var name = (tds[4].textContent || "").trim();
				if (name) invoiceNames.push(name);
			}

			if (needsFetch && !_phoneFetchDone && invoiceNames.length > 0) {
				_phoneFetchDone = true;
				log("Fetching phone data for " + invoiceNames.length + " invoices");
				frappe.call({
					method: "bix_pos_custom.api.invoice.get_invoice_phones",
					args: { invoice_names: JSON.stringify(invoiceNames) },
					async: true,
					callback: function (r) {
						if (r && r.message) {
							_draftsPhoneMap = r.message;
							log("Phone data received:", _draftsPhoneMap);
							/* Now inject cells with the data */
							var tbl = document.querySelector(
								".drafts-dialog-card .drafts-dialog-table"
							);
							if (tbl) _injectPhoneCells(tbl);
							/* Also handle compact view */
							var crd = document.querySelector(".drafts-dialog-card");
							if (crd) _injectPhoneCompact(crd);
						}
					},
				});
			} else if (Object.keys(_draftsPhoneMap).length > 0) {
				_injectPhoneCells(table);
			}
		}

		/* Compact view — inject if data already fetched */
		if (Object.keys(_draftsPhoneMap).length > 0) {
			_injectPhoneCompact(card);
		}
	}

	function _injectPhoneHeader(table) {
		var headerRow = table.querySelector("thead tr");
		if (!headerRow || headerRow.querySelector(".bix-phone-header")) return;
		var ths = headerRow.querySelectorAll("th");
		/* ths: [0]=checkbox, [1]=Customer, [2]=Date, [3]=Time, [4]=Invoice, [5]=Amount */
		if (ths.length < 2) return;

		var phoneTh = document.createElement("th");
		phoneTh.className = "bix-phone-header v-data-table__th";
		phoneTh.textContent = "Phone";
		phoneTh.style.cssText =
			"text-align:start;font-size:0.75rem;font-weight:600;" +
			"letter-spacing:0.02em;padding:0 16px;height:48px;";

		/* Insert after Customer (ths[1]), before Date (ths[2]) */
		if (ths[2]) {
			headerRow.insertBefore(phoneTh, ths[2]);
		} else {
			headerRow.appendChild(phoneTh);
		}
		log("Phone header injected");
	}

	function _injectPhoneCells(table) {
		var rows = table.querySelectorAll("tbody tr");
		for (var i = 0; i < rows.length; i++) {
			if (rows[i].querySelector(".bix-phone-cell")) continue;
			var tds = rows[i].querySelectorAll("td");
			/* Need at least 6 cols: checkbox, customer, date, time, invoice, amount */
			if (tds.length < 6) continue;

			/* Invoice name is at tds[4] (before our injection shifts indices) */
			var invoiceName = (tds[4].textContent || "").trim();
			var phone = _draftsPhoneMap[invoiceName] || "";

			var phoneTd = document.createElement("td");
			phoneTd.className = "bix-phone-cell v-data-table__td";
			phoneTd.textContent = phone;
			phoneTd.style.cssText = "padding:0 16px;";

			/* Insert after customer (tds[1]), before date (tds[2]) */
			if (tds[2]) {
				rows[i].insertBefore(phoneTd, tds[2]);
			}
		}
	}

	function _injectPhoneCompact(card) {
		var items = card.querySelectorAll(".drafts-dialog-item");
		for (var j = 0; j < items.length; j++) {
			if (items[j].querySelector(".bix-phone-display")) continue;

			var identity = items[j].querySelector(".drafts-dialog-item__identity");
			if (!identity) continue;

			/* Invoice name is in the <span> inside identity */
			var span = identity.querySelector("span");
			if (!span) continue;
			var invoiceName = (span.textContent || "").trim();

			var phone = _draftsPhoneMap[invoiceName] || "";
			if (!phone) continue;

			var phoneEl = document.createElement("span");
			phoneEl.className = "bix-phone-display";
			phoneEl.style.cssText = "font-size:0.85em;opacity:0.7;display:block;";
			phoneEl.textContent = phone;

			identity.appendChild(phoneEl);
		}
	}
})();
