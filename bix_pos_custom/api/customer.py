import json
import frappe
from frappe import _


@frappe.whitelist()
def create_customer(
	customer_name,
	company,
	pos_profile_doc,
	customer_id=None,
	tax_id=None,
	mobile_no=None,
	email_id=None,
	referral_code=None,
	birthday=None,
	customer_group=None,
	territory=None,
	customer_type=None,
	gender=None,
	method="create",
	address_line1=None,
	city=None,
	country=None,
):
	"""
	Override of posawesome create_customer.

	Changes:
	- Duplicate check is now on mobile_no (phone number) instead of customer_name.
	  Multiple customers may share the same name, but each phone number must be unique.
	- On update, the current customer is excluded from the phone uniqueness check.
	"""
	from posawesome.posawesome.api.customers import create_customer as _posa_create

	if method == "create":
		_check_phone_uniqueness(mobile_no, exclude_customer=None)

		# Allow same customer names — bypass posawesome's name-duplicate guard
		# by injecting posa_allow_duplicate_customer_names into the profile.
		pos_profile = json.loads(pos_profile_doc)
		pos_profile["posa_allow_duplicate_customer_names"] = True
		pos_profile_doc = json.dumps(pos_profile)

	elif method == "update":
		_check_phone_uniqueness(mobile_no, exclude_customer=customer_id)

	return _posa_create(
		customer_name=customer_name,
		company=company,
		pos_profile_doc=pos_profile_doc,
		customer_id=customer_id,
		tax_id=tax_id,
		mobile_no=mobile_no,
		email_id=email_id,
		referral_code=referral_code,
		birthday=birthday,
		customer_group=customer_group,
		territory=territory,
		customer_type=customer_type,
		gender=gender,
		method=method,
		address_line1=address_line1,
		city=city,
		country=country,
	)


def _check_phone_uniqueness(mobile_no, exclude_customer=None):
	"""Raise an error if mobile_no is missing or already used by another customer."""
	if not mobile_no:
		frappe.throw(_("Phone number is mandatory"))
		return

	filters = {"mobile_no": mobile_no}
	if exclude_customer:
		filters["name"] = ["!=", exclude_customer]

	existing = frappe.db.get_value("Customer", filters, "customer_name")
	if existing:
		frappe.throw(
			_("Phone number {0} is already registered to customer: {1}").format(
				mobile_no, existing
			)
		)
