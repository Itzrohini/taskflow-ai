from html import escape


def escape_delimited_text(value: str) -> str:
    return escape(value, quote=False)
