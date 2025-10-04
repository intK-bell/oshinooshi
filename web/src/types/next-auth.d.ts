declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface JWT {
    lineId?: string;
    name?: string | null;
    picture?: string | null;
  }
}
