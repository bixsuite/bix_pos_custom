/**
 * bix_pos_custom — POS item search enhancement (v3)
 *
 * Behavior:
 * - Barcode (pure numeric, 6–13 digits like UPC/EAN): posawesome handles normally
 * - Item code (alphanumeric like "INNAYA101"): on Enter, if exactly one item
 *   is displayed, click it to add to cart, then clear the search field.
 *
 * Supports both card view and table/list view (default).
 */
(function () {
	"use strict";

	var DEBUG = true;

	function log() {
		if (!DEBUG) return;
		var args = Array.prototype.slice.call(arguments);
		args.unshift("[bix_pos_custom v3]");
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
	});

	_observer.observe(document.body, { childList: true, subtree: true });

	if (getShell()) {
		attach();
	}
})();
