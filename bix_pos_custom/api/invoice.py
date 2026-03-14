import json

import frappe
from frappe import _


@frappe.whitelist()
def get_draft_invoices(pos_opening_shift, doctype="Sales Invoice", limit_page_length=0):
	"""
	Override of posawesome get_draft_invoices.

	Changes:
	- Returns mobile_no for each invoice's customer (used by bix_pos_custom
	  frontend to display a Phone column in the Load Drafts dialog).
	"""
	from posawesome.posawesome.api.invoices import get_draft_invoices as _posa_get_drafts

	invoices = _posa_get_drafts(
		pos_opening_shift=pos_opening_shift,
		doctype=doctype,
		limit_page_length=limit_page_length,
	)

	# Batch-fetch phone numbers for all customers in one query
	customer_ids = list({inv.get("customer") for inv in invoices if inv.get("customer")})
	phone_map = {}
	if customer_ids:
		rows = frappe.get_all(
			"Customer",
			filters={"name": ["in", customer_ids]},
			fields=["name", "mobile_no"],
		)
		phone_map = {r["name"]: r["mobile_no"] for r in rows if r.get("mobile_no")}

	for inv in invoices:
		inv["mobile_no"] = phone_map.get(inv.get("customer"), "")

	return invoices


@frappe.whitelist()
def get_invoice_phones(invoice_names):
	"""Return {invoice_name: mobile_no} for a list of Sales Invoice names."""
	names = json.loads(invoice_names) if isinstance(invoice_names, str) else invoice_names
	if not names:
		return {}

	invoices = frappe.get_all(
		"Sales Invoice",
		filters={"name": ["in", names]},
		fields=["name", "customer"],
	)
	customer_ids = list({inv.customer for inv in invoices if inv.customer})
	if not customer_ids:
		return {}

	customers = frappe.get_all(
		"Customer",
		filters={"name": ["in", customer_ids]},
		fields=["name", "mobile_no"],
	)
	cust_phone = {c.name: c.mobile_no for c in customers if c.mobile_no}

	return {inv.name: cust_phone.get(inv.customer, "") for inv in invoices}
