import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query')?.trim();

  if (!query) {
    return NextResponse.json({ error: 'Ingresa un ID o Nombre de Usuario' }, { status: 400 });
  }

  try {
    let userId = query;

    // Buscar ID por Username si no es numérico
    if (!/^\d+$/.test(query)) {
      const userLookupRes = await fetch('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [query], excludeBannedUsers: false }),
      });

      if (userLookupRes.ok) {
        const lookupData = await userLookupRes.json();
        if (lookupData.data && lookupData.data.length > 0) {
          userId = lookupData.data[0].id.toString();
        } else {
          return NextResponse.json({ error: `No se encontró el usuario "${query}"` }, { status: 404 });
        }
      } else {
        return NextResponse.json({ error: 'Error al buscar el usuario' }, { status: 500 });
      }
    }

    // 1. Obtener perfil del usuario
    const userRes = await fetch(`https://users.roblox.com/v1/users/${userId}`);
    if (!userRes.ok) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: userRes.status });
    }
    const userData = await userRes.json();

    // 2. Obtener equipamiento del avatar
    const avatarRes = await fetch(`https://avatar.roblox.com/v1/users/${userId}/avatar`);
    let assets: any[] = [];
    if (avatarRes.ok) {
      const avatarData = await avatarRes.json();
      assets = avatarData.assets || [];
    }

    // 3. Obtener miniaturas (Thumbnails) de cada ítem equipable
    let assetThumbnails: Record<number, string> = {};
    if (assets.length > 0) {
      const assetIds = assets.map((a) => a.id).filter(Boolean);

      if (assetIds.length > 0) {
        try {
          const thumbRes = await fetch(
            `https://thumbnails.roblox.com/v1/assets?assetIds=${assetIds.join(',')}&size=150x150&format=Png&isCircular=false`
          );
          if (thumbRes.ok) {
            const thumbData = await thumbRes.json();
            thumbData.data?.forEach((item: any) => {
              if (item.targetId && item.imageUrl) {
                assetThumbnails[item.targetId] = item.imageUrl;
              }
            });
          }
        } catch (e) {
          console.error('Error al obtener thumbnails de assets:', e);
        }
      }
    }

    // 4. Obtener Render del Cuerpo Completo
    const fullBodyRes = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png&isCircular=false`
    );
    let fullBodyUrl = '';
    if (fullBodyRes.ok) {
      const fbData = await fullBodyRes.json();
      fullBodyUrl = fbData.data?.[0]?.imageUrl || '';
    }

    // 5. Obtener Headshot (Foto de perfil)
    const headshotRes = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=true`
    );
    let headshotUrl = '';
    if (headshotRes.ok) {
      const hsData = await headshotRes.json();
      headshotUrl = hsData.data?.[0]?.imageUrl || '';
    }

    return NextResponse.json({
      id: userData.id,
      name: userData.name,
      displayName: userData.displayName,
      description: userData.description || 'Sin descripción',
      created: userData.created,
      isBanned: userData.isBanned,
      fullBodyUrl,
      headshotUrl,
      assets: assets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        type: asset.assetType?.name || 'Accesorio',
        imageUrl: assetThumbnails[asset.id] || `https://tr.rbxcdn.com/${asset.id}/150/150/AvatarItem/Png`,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Error al consultar los datos' }, { status: 500 });
  }
}