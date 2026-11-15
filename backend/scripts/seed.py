# -*- coding: utf-8 -*-
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.security import hash_password
from database.models.user import Role, User
from database.session import Base, SessionLocal, engine


def main() -> None:
    Path(ROOT).parent.joinpath("data").mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for name, desc in (("admin", "Administrator"), ("user", "Registered user")):
            if not db.query(Role).filter(Role.name == name).first():
                db.add(Role(name=name, description=desc))
        db.commit()
        admin_role = db.query(Role).filter(Role.name == "admin").first()
        if not db.query(User).filter(User.email == "admin@mani.nova3").first():
            db.add(
                User(
                    email="admin@mani.nova3",
                    full_name="MANI Admin",
                    hashed_password=hash_password("Nova3Mani!"),
                    role_id=admin_role.id,
                    is_active=True,
                )
            )
            db.commit()
            print("Seeded admin@mani.nova3 / Nova3Mani!")
        else:
            print("Admin already exists")
    finally:
        db.close()


if __name__ == "__main__":
    main()
