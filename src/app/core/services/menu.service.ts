import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MenuNode {
  id: number;
  parentId: number | null;
  title: string;
  icon: string;
  path: string | null;
  children?: MenuNode[];
}

@Injectable({
  providedIn: 'root',
})
export class MenuService {
  private http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:3000/api/menus';

  getSidebarMenu(): Observable<{ status: string; data: MenuNode[] }> {
    // 💥 EL TRUCO ANTICACHÉ DEFINITIVO: Generamos una semilla basada en el milisegundo actual
    const antiCacheSeed = new Date().getTime();

    // Inyectamos la semilla en la URL de la petición.
    // Al ser una URL única en cada clic (ej: /sidebar?t=1789393828), el navegador se verá obligado
    // a saltarse su caché local (eliminando el código 304) y consultará en vivo a tu Node.js
    return this.http.get<{ status: string; data: MenuNode[] }>(
      `${this.API_URL}/sidebar?t=${antiCacheSeed}`,
    );
  }
}
