"""Comandos de administración (desde la carpeta api/):

    python -m app.cli create-user tu@correo.com
    python -m app.cli set-password tu@correo.com

La contraseña se pide en la terminal sin mostrarse.
"""

import argparse
import getpass
import sys

from app.db import get_session_factory
from app.users import UserError, create_user, set_password


def ask_password() -> str:
    password = getpass.getpass("Contraseña: ")
    if password != getpass.getpass("Repite la contraseña: "):
        raise UserError("Las contraseñas no coinciden")
    return password


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("create-user", help="crea el usuario").add_argument("email")
    commands.add_parser(
        "set-password", help="cambia la contraseña y cierra todas las sesiones"
    ).add_argument("email")
    args = parser.parse_args(argv)

    try:
        password = ask_password()
        with get_session_factory()() as db:
            if args.command == "create-user":
                create_user(db, args.email, password)
                print(f"Usuario {args.email} creado.")
            else:
                set_password(db, args.email, password)
                print("Contraseña cambiada; se cerraron todas las sesiones.")
    except UserError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
