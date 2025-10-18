import type { DefaultSession } from "next-auth";
import type { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      uuid?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    lineId?: string;
    picture?: string | null;
    userProfile?: {
      user_uuid?: string;
      display_name?: string;
      picture?: string;
    };
  }
}

export {};
