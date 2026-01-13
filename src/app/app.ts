//app.ts
import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { environment } from '../environments/environment';
// Importaciones de Firebase
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, User, signOut, signInWithEmailAndPassword, Auth } from 'firebase/auth';
import { getDatabase, Database, ref, onValue, set, push, update, get, query, orderByChild, remove } from 'firebase/database';
// Definición de Tipos de Datos (Interfaces)
interface Empleado {
  uid: string; // Document ID (RFID Tag UID)
  nombre: string;
  numeroEmpleado: string;
  rol: 'Conductor' | 'Supervisor' | 'Administrador';
  fechaAlta: Date;
}

interface AsistenciaLog {
  id: string; // Document ID
  uid: string | null; // 🛑 CORRECCIÓN: Ahora acepta null de Firebase
  nombre: string | null; // 🛑 CORRECCIÓN: Ahora acepta null de Firebase
  timestamp: Date;
}

// Interfaz para la data del gráfico
interface DailyUsage {
  date: string;
  count: number;
}

// --- Componente Principal ---
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <!-- Fondo Oscuro y Fuente Global -->
    <div class="min-h-screen bg-gray-900 text-gray-100 font-sans">
      
      <!-- Modal de Notificación Global -->
      <div *ngIf="message()" class="fixed top-5 left-1/2 -translate-x-1/2 z-50 p-4 rounded-lg shadow-2xl transition-opacity duration-300"
          [ngClass]="{'bg-blue-600': messageType() === 'success', 'bg-red-600': messageType() === 'error', 'bg-yellow-500': messageType() === 'info'}">
        <div class="flex items-center space-x-2">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span class="font-medium">{{ message() }}</span>
        </div>
      </div>

      <!-- Spinner de Carga Global -->
      <div *ngIf="isLoading()" class="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex items-center justify-center">
        <div class="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>

      <!-- --------------------- PANTALLA DE ERROR DE CONFIGURACIÓN --------------------- -->
      <div *ngIf="!isFirebaseInitialized()" class="flex items-center justify-center min-h-screen p-4">
        <div class="w-full max-w-lg bg-red-900/20 p-8 rounded-xl shadow-2xl border border-red-700">
          <h2 class="text-3xl font-extrabold text-red-400 text-center mb-4">Error de Conexión a Firebase</h2>
          <p class="text-red-300 text-center">
            No se pudo inicializar la aplicación de Firebase. Esto es causado generalmente por una clave de API inválida o faltante en la configuración.
          </p>
          <p class="text-red-300 text-center mt-4 text-sm font-mono">
            Error: auth/invalid-api-key
          </p>
          <p class="text-gray-400 text-center mt-6">
            Por favor, revisa la configuración de Firebase proporcionada a la aplicación para asegurar que sea correcta, especialmente las restricciones de la API Key en Google Cloud Console.
          </p>
        </div>
      </div>

      <!-- Contenido Principal (solo si Firebase está inicializado) -->
      <ng-container *ngIf="isFirebaseInitialized()">
        
        <!-- --------------------- PANTALLA DE INICIO DE SESIÓN --------------------- -->
        <div *ngIf="!isAuthReady() || !isLoggedIn()" class="flex items-center justify-center min-h-screen p-4">
          <div class="w-full max-w-md bg-gray-800 p-8 rounded-xl shadow-2xl border border-blue-700/50">
            <h2 class="text-3xl font-extrabold text-white text-center mb-6">Iniciar sesión</h2>
            <form [formGroup]="loginForm" (ngSubmit)="login()" class="space-y-6">
              <div>
                <label for="email" class="block text-sm font-medium text-gray-300 mb-1">Correo electrónico</label>
                <input id="email" type="email" formControlName="email" required
                      class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400">
                <div *ngIf="loginForm.get('email')?.invalid && loginForm.get('email')?.touched" class="text-red-400 text-xs mt-1">
                  Correo es requerido.
                </div>
              </div>
              <div>
                <label for="password" class="block text-sm font-medium text-gray-300 mb-1">Contraseña</label>
                <input id="password" type="password" formControlName="password" required
                      class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400">
                <div *ngIf="loginForm.get('password')?.invalid && loginForm.get('password')?.touched" class="text-red-400 text-xs mt-1">
                  Contraseña es requerida.
                </div>
              </div>
              <button type="submit" [disabled]="loginForm.invalid || isLoading()"
                      class="w-full py-2.5 rounded-lg font-semibold transition duration-200"
                      [ngClass]="{'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/50': !loginForm.invalid && !isLoading(), 'bg-blue-900 text-gray-500 cursor-not-allowed': loginForm.invalid || isLoading()}">
                {{ isLoading() ? 'Iniciando Sesión...' : 'Ingresar' }}
              </button>
            </form>
            <p *ngIf="!currentUser() && isAuthReady()" class="text-xs text-gray-500 mt-4 text-center">
              ID de la Aplicación: {{ appId }}
            </p>
            <p class="text-xs text-gray-500 mt-1 text-center">
              ID de usuario (Admin): {{ currentUser()?.uid || 'No autenticado' }}
            </p>
          </div>
        </div>

        <!-- --------------------- DASHBOARD PRINCIPAL --------------------- -->
 <div *ngIf="isLoggedIn()" class="flex flex-col md:flex-row">
          
          <nav class="bg-gray-800 text-white w-full md:w-64 flex-shrink-0 shadow-lg md:h-screen sticky top-0 z-10 md:sticky md:block">
            <div class="p-6 border-b border-blue-700/30">
              <h1 class="text-2xl font-bold text-blue-400">Control de vehículos</h1>
              <p class="text-sm text-gray-400 mt-1">Panel de administración</p>
            </div>
            <ul class="flex md:flex-col overflow-x-auto p-2 md:p-4">
              @for (item of navItems; track item.view) {
                <li class="flex-shrink-0 mx-1 md:mx-0 md:mb-2">
                  <button (click)="currentView.set(item.view)"
                          class="flex items-center w-full px-4 py-2.5 rounded-lg text-sm font-medium transition duration-150"
                          [ngClass]="{
                            'bg-blue-600 text-white shadow-md hover:bg-blue-700': currentView() === item.view,
                            'text-gray-300 hover:bg-gray-700 hover:text-blue-400': currentView() !== item.view
                          }">
                    <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="item.iconPath"></path>
                    </svg>
                    {{ item.label }}
                  </button>
                </li>
              }
              <li class="flex-shrink-0 mx-1 md:mx-0 md:mt-4">
                <button (click)="logout()"
                        class="flex items-center w-full px-4 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-900/30 transition duration-150">
                  <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1m-3 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                  Cerrar sesión
                </button>
              </li>
            </ul>
          </nav>

          <main class="flex-grow p-4 md:p-8">
            
            <div *ngIf="currentView() === 'dashboard'" class="space-y-8">
              <h2 class="text-3xl font-extrabold text-blue-400 border-b pb-2 border-gray-700">Pantalla principal</h2>

                <div class="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                  <h3 class="text-xl font-semibold mb-4 text-white">Esta semana</h3>
                  
                  <div class="flex flex-col space-y-2">
                    <div class="flex justify-between items-end h-40 border-l border-b border-gray-700 pb-2 pl-2">
                      @for (data of dailyUsageData(); track data.date) {
                        <div class="flex flex-col items-center w-1/7 h-full justify-end">
                          <div class="w-3/4 bg-blue-600 rounded-t-lg transition-all duration-500 ease-out hover:bg-blue-400"
                              [style.height.%]="(data.count / maxDailyCount()) * 90">
                          </div>
                          <span class="text-xs text-gray-300 mt-1">{{ data.count }}</span>
                        </div>
                      }
                    </div>
                    
                    <div class="flex justify-between text-xs text-gray-400 px-4">
                      @for (data of dailyUsageData(); track data.date) {
                        <span>{{ data.date }}</span>
                      }
                    </div>
                  </div>
                </div>

<div class="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
  <h3 class="text-xl font-semibold mb-4 text-white">Registros recientes</h3>
  <div class="overflow-x-auto">
    <table class="min-w-full divide-y divide-gray-700">
      <thead>
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Nombre</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">UID (Tarjeta)</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha y hora</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-700">
        @for (log of recentLogs(); track log.id) {
          <tr class="hover:bg-gray-700 transition duration-150">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{{ log.nombre ?? 'N/A' }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400 hidden sm:table-cell">{{ log.uid ?? 'N/A' }}</td>
            <td class="px-6 py-4 text-sm text-gray-400">{{ log.timestamp | date:'MMM d, y, HH:mm:ss' }}</td>          </tr>
        }
        @empty {
          <tr><td colspan="3" class="px-6 py-4 text-center text-gray-500">No hay registros recientes.</td></tr>
        }
      </tbody>
    </table>
  </div>
</div>
            </div>

            <!-- --------------------- VISTA: ASISTENCIA --------------------- -->
            <div *ngIf="currentView() === 'logs'" class="space-y-8">
              <h2 class="text-3xl font-extrabold text-blue-400 border-b pb-2 border-gray-700">Administración de registros</h2>
              
              <div class="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                <h3 class="text-xl font-semibold mb-4 text-white">Filtros de búsqueda</h3>
                <form [formGroup]="logFilterForm" (ngSubmit)="applyLogFilters()" class="space-y-4 md:space-y-0 md:flex md:space-x-4">
                  <!-- Filtro de Nombre -->
                  <div class="flex-1">
                    <label for="employeeName" class="block text-sm font-medium text-gray-300 mb-1">Nombre (búsqueda parcial)</label>
                    <input id="employeeName" type="text" formControlName="employeeName" placeholder="Ej: Juan Pérez"
                          class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500">
                  </div>
                  
                  <!-- Filtro de Fecha de Inicio -->
                  <div class="flex-1">
                    <label for="startDate" class="block text-sm font-medium text-gray-300 mb-1">Fecha de inicio</label>
                    <input id="startDate" type="date" formControlName="startDate"
                          class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500">
                  </div>
                  
                  <!-- Filtro de Fecha Fin -->
                  <div class="flex-1">
                    <label for="endDate" class="block text-sm font-medium text-gray-300 mb-1">Fecha de fin</label>
                    <input id="endDate" type="date" formControlName="endDate"
                          class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500">
                  </div>
                  
                  <div class="flex items-end space-x-2">
                    <button type="submit"
                            class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-200">
                      Filtrar
                    </button>
                    <button type="button" (click)="clearLogFilters()"
                            class="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-200">
                      Limpiar
                    </button>
                  </div>
                </form>
              </div>

              <!-- Tabla de Registros Filtrados -->
              <div class="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                <h3 class="text-xl font-semibold mb-4 text-white">Resultados (Total: {{ filteredLogs().length }})</h3>
                <div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-gray-700">
                    <thead>
                      <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Nombre</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">ID de Tarjeta (UID)</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha y Hora</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-700">
                      @for (log of paginatedLogs(); track log.id) {
                        <tr class="hover:bg-gray-700 transition duration-150">
                          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{{ log.nombre }}</td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400 hidden sm:table-cell">{{ log.uid }}</td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{{ log.timestamp | date:'MMM d, y, HH:mm:ss' }}</td>
                        </tr>
                      }
                      @empty {
                        <tr><td colspan="3" class="px-6 py-4 text-center text-gray-500">No hay registros que coincidan con los filtros.</td></tr>
                      }
                    </tbody>
                  </table>
                </div>

                <!-- Paginación -->
                <div class="flex justify-between items-center mt-4">
                  <span class="text-sm text-gray-400">Página {{ currentPage() }} de {{ totalLogPages() }}</span>
                  <div class="flex space-x-2">
                    <button (click)="previousLogPage()" [disabled]="currentPage() === 1"
                            class="px-3 py-1 text-sm rounded-lg transition duration-150"
                            [ngClass]="{'bg-blue-600 hover:bg-blue-700 text-white': currentPage() > 1, 'bg-gray-700 text-gray-500 cursor-not-allowed': currentPage() === 1}">
                      Anterior
                    </button>
                    <button (click)="nextLogPage()" [disabled]="currentPage() === totalLogPages()"
                            class="px-3 py-1 text-sm rounded-lg transition duration-150"
                            [ngClass]="{'bg-blue-600 hover:bg-blue-700 text-white': currentPage() < totalLogPages(), 'bg-gray-700 text-gray-500 cursor-not-allowed': currentPage() === totalLogPages()}">
                      Siguiente
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- --------------------- VISTA: EMPLEADOS --------------------- -->
<div *ngIf="currentView() === 'employees'" class="space-y-8">
              <h2 class="text-3xl font-extrabold text-blue-400 border-b pb-2 border-gray-700">Gestión de usuarios</h2>

              <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                <input type="text" [(ngModel)]="employeeSearchTerm" (ngModelChange)="filterEmployees()" placeholder="Buscar por Nombre o # Empleado..."
                      class="w-full sm:w-80 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500">
                <button (click)="openEmployeeModal()"
                        class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-200 flex items-center">
                  <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                  Añadir empleado
                </button>
              </div>

              <div class="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                <div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-gray-700">
                    <thead>
                      <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Nombre</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell"># Empleado</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">UID Tarjeta</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Rol</th>
                        <th class="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-700">
                      @for (emp of filteredEmployees(); track emp.uid) {
                        <tr class="hover:bg-gray-700 transition duration-150">
                          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{{ emp.nombre }}</td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400 hidden sm:table-cell">{{ emp.numeroEmpleado }}</td>
                          <td class="px-6 py-4 whitespace-nowrap text-xs font-mono text-blue-400 hidden lg:table-cell">{{ emp.uid }}</td>
                          <td class="px-6 py-4 whitespace-nowrap">
                              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                                    [ngClass]="{'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300': emp.rol === 'Conductor', 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300': emp.rol !== 'Conductor'}">
                                {{ emp.rol }}
                              </span>
                          </td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-center space-x-3">
                            <button (click)="openEmployeeModal(emp)" title="Editar"
                                    class="text-blue-400 hover:text-blue-300 transition duration-150">
                              <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </button>
                            <button (click)="deleteEmployee(emp)" title="Eliminar"
                                    class="text-red-400 hover:text-red-300 transition duration-150">
                              <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                          </td>
                        </tr>
                      }
                      @empty {
                        <tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">No hay empleados registrados.</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
          </main>
        </div>
        
        <div *ngIf="isEmployeeModalOpen()" class="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div class="bg-gray-800 w-full max-w-lg rounded-xl shadow-2xl p-6 border border-blue-700/50">
            <h3 class="text-2xl font-bold text-white mb-4">{{ isEditingMode() ? 'Editar Empleado' : 'Nuevo Empleado' }}</h3>
            
            <form [formGroup]="employeeForm" (ngSubmit)="saveEmployee()" class="space-y-4">
              
              <div>
                <label for="uid" class="block text-sm font-medium text-gray-300 mb-1">UID de Tarjeta RFID (Document ID)</label>
                <input id="uid" type="text" formControlName="uid" required 
                      [readonly]="isEditingMode()"
                      class="w-full px-4 py-2 rounded-lg text-white font-mono"
                      [ngClass]="isEditingMode() ? 'bg-gray-700 cursor-not-allowed border border-gray-600' : 'bg-gray-700 border border-blue-500 focus:ring-blue-500'">
                <div *ngIf="employeeForm.get('uid')?.invalid && employeeForm.get('uid')?.touched" class="text-red-400 text-xs mt-1">
                  UID es requerido (ej: ABCD1234).
                </div>
              </div>

              <div>
                <label for="nombre" class="block text-sm font-medium text-gray-300 mb-1">Nombre completo</label>
                <input id="nombre" type="text" formControlName="nombre" required
                      class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-blue-500 focus:border-blue-500">
                <div *ngIf="employeeForm.get('nombre')?.invalid && employeeForm.get('nombre')?.touched" class="text-red-400 text-xs mt-1">
                  Nombre es requerido.
                </div>
              </div>

              <div>
                <label for="numeroEmpleado" class="block text-sm font-medium text-gray-300 mb-1">Número de empleado</label>
                <input id="numeroEmpleado" type="text" formControlName="numeroEmpleado" required
                      class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-blue-500 focus:border-blue-500">
              </div>

              <div>
                <label for="rol" class="block text-sm font-medium text-gray-300 mb-1">Rol</label>
                <select id="rol" formControlName="rol" required
                        class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-blue-500 focus:border-blue-500">
                  <option value="Conductor">Conductor</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Administrador">Administrador</option>
                </select>
              </div>

              <div class="flex justify-end space-x-3 pt-4">
                <button type="button" (click)="closeEmployeeModal()"
                        class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition duration-200">
                  Cancelar
                </button>
                <button type="submit" [disabled]="employeeForm.invalid || isLoading()"
                        class="px-4 py-2 font-semibold rounded-lg transition duration-200"
                        [ngClass]="{'bg-blue-600 hover:bg-blue-700 text-white': !employeeForm.invalid && !isLoading(), 'bg-blue-900 text-gray-500 cursor-not-allowed': employeeForm.invalid || isLoading()}">
                  {{ isEditingMode() ? 'Guardar Cambios' : 'Crear Empleado' }}
                </button>
              </div>
            </form>
          </div>
        </div>

      </ng-container>
      
    </div>
  `,
  styles: [`
    /* Estilos Generales y Scrollbar para la estética oscura */
    :host {
      --scrollbar-thumb: #3b82f6; /* blue-500 */
      --scrollbar-track: #1f2937; /* gray-800 */
    }
    
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-thumb {
      background: var(--scrollbar-thumb);
      border-radius: 4px;
    }

    ::-webkit-scrollbar-track {
      background: var(--scrollbar-track);
    }
    
    /* Pequeña animación de zoom en tarjetas */
    .bg-gray-800.p-6.rounded-xl.shadow-lg:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3), 0 4px 6px -2px rgba(59, 130, 246, 0.1);
        transition: all 0.3s ease-in-out;
    }
    
    /* Estilo específico para la tabla de logs para que se vean mejor las filas */
    table {
        border-collapse: separate;
        border-spacing: 0 8px;
    }
    tbody tr {
        background-color: #1f2937; /* gray-800 */
        border-radius: 8px;
    }
    
    tbody td {
        border-top: 1px solid #374151; /* gray-700 */
        border-bottom: 1px solid #374151; /* gray-700 */
    }
    
    tbody tr:first-child td {
        border-top: none;
    }
    
    tbody tr:last-child td {
        border-bottom: none;
    }
    
    /* Clases para esquinas redondeadas en las celdas de las tablas */
    .divide-y > * > tr > td:first-child,
    .divide-y > * > tr > th:first-child {
        border-top-left-radius: 0.5rem;
        border-bottom-left-radius: 0.5rem;
        padding-left: 1.5rem;
    }
    .divide-y > * > tr > td:last-child,
    .divide-y > * > tr > th:last-child {
        border-top-right-radius: 0.5rem;
        border-bottom-right-radius: 0.5rem;
        padding-right: 1.5rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit, OnDestroy {
  // --- INYECCIONES Y CONFIGURACIÓN INICIAL ---
  private fb = inject(FormBuilder);
  
  // Variables globales de Firebase (deben estar definidas en el entorno)
  public appId = environment.firebaseConfig.appId; // Usamos el appId del objeto de configuración
  // Configuracion de Firebase cargada directamente de environment.ts
  private firebaseConfig = environment.firebaseConfig;
  private initialAuthToken: string | undefined = undefined;
  // Instancias de Firebase (inicializadas en initializeFirebase)
  private app!: FirebaseApp;
  private auth!: Auth;
private db!: Database;  
  // --- ESTADO DE AUTENTICACIÓN Y CARGA ---
  currentUser = signal<User | null>(null);
  isAuthReady = signal(false);
  isLoggedIn = signal(false); 
  isLoading = signal(false);
  isEditingMode = signal<boolean>(false); // 🛑 NUEVA SEÑAL PARA SEGUIR EL MODO DEL MODAL
// ...
  
  // NUEVO: Estado de la Inicialización de Firebase
  isFirebaseInitialized = signal(false);

  // --- ESTADO DE LA APLICACIÓN Y DATA ---
  currentView = signal<'dashboard' | 'logs' | 'employees'>('dashboard');
  
  // Data de Empleados
  allEmployees = signal<Empleado[]>([]);
  employeeSearchTerm = '';
  filteredEmployees = signal<Empleado[]>([]);

  // Data de Logs
  allLogs = signal<AsistenciaLog[]>([]);
  recentLogs = computed(() => this.allLogs().slice(0, 5));
  dailyUsageData = signal<DailyUsage[]>([]);
  maxDailyCount = computed(() => Math.max(...this.dailyUsageData().map(d => d.count), 1));
  
  // Paginación y Filtrado de Logs
  logItemsPerPage = 10;
  currentPage = signal(1);
  filteredLogs = signal<AsistenciaLog[]>([]);
  totalLogPages = computed(() => Math.ceil(this.filteredLogs().length / this.logItemsPerPage));

  // Data de la página actual para la tabla de logs
  paginatedLogs = computed(() => {
    const start = (this.currentPage() - 1) * this.logItemsPerPage;
    return this.filteredLogs().slice(start, start + this.logItemsPerPage);
  });
  
  // Modales y Formularios
  isEmployeeModalOpen = signal(false);
  employeeForm = this.fb.group({
    uid: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9]{4,10}$/)]], // 4-10 caracteres alfanuméricos
    nombre: ['', Validators.required],
    numeroEmpleado: ['', Validators.required],
    rol: ['Conductor', Validators.required],
    fechaAlta: [Date.now()],
  });

// En la definición de loginForm
loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]], // Antes tenía el correo de prueba
    password: ['', Validators.required], // Antes tenía la contraseña
});
  
  logFilterForm = this.fb.group({
    employeeName: [''],
    startDate: [''],
    endDate: [''],
  });

  // Notificaciones
  message = signal<string | null>(null);
  messageType = signal<'success' | 'error' | 'info'>('info');

  // Navegación
  navItems: { view: 'dashboard' | 'logs' | 'employees', label: string, iconPath: string }[] = [
    { view: 'dashboard', label: 'Dashboard', iconPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v7m-11 7h10a1 1 0 001-1v-4m-12 4h1a1 1 0 011-1v-4m-12 4h1a1 1 0 011-1v-4' },
    { view: 'logs', label: 'Registros de uso', iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h.01M15 15h.01M9 15h.01' },
    { view: 'employees', label: 'Gestión de empleados', iconPath: 'M17 20h-1a1 1 0 01-1-1v-3.889a2 2 0 00-2-2H9a2 2 0 00-2 2V19a1 1 0 01-1 1H5a1 1 0 01-1-1v-1a5 5 0 015-5h6a5 5 0 015 5v1a1 1 0 01-1 1zm-2-9a4 4 0 11-8 0 4 4 0 018 0z' },
  ];
  
  // --- CICLO DE VIDA ---
  ngOnInit(): void {
  //  setLogLevel('debug'); // Configurar nivel de log de Firebase para depuración
    this.initializeFirebase(); // Intentar inicializar Firebase primero
    if (this.isFirebaseInitialized()) {
      this.setupAuthAndListeners();
    }
  }

  ngOnDestroy(): void {
    // Aquí se podrían desuscribir los listeners de Firestore si la aplicación se destruyera
  }
  
  // --- FIREBASE: INICIALIZACIÓN PROTEGIDA ---
  private initializeFirebase(): void {
    try {
      // Intenta inicializar con la configuración provista por el entorno.
      this.app = initializeApp(this.firebaseConfig);
      this.auth = getAuth(this.app);
      this.db = getDatabase(this.app);
      this.isFirebaseInitialized.set(true);
    } catch (error: any) {
      console.error('ERROR CRÍTICO: Fallo al inicializar Firebase. Revise __firebase_config.', error);
      // Detiene la inicialización del resto de la aplicación si falla.
      this.isFirebaseInitialized.set(false);
      // Solo mostrar el error específico de Firebase si existe, sino un mensaje genérico
      const errorCode = error.code ? error.code.replace('auth/', '') : 'Configuración inválida';
      this.showMessage(`Error de Configuración: ${errorCode}`, 'error');
    }
  }

// --- FIREBASE: REFERENCIAS DE DATOS (Realtime Database) ---
// 🛑 REEMPLAZA EL BLOQUE ANTERIOR POR ESTE CÓDIGO:

private get empleadosRef() {
    if (!this.db) throw new Error("Database no inicializada");
    // Ruta de Realtime Database: /empleados
    return ref(this.db, 'empleados');
}

private get logsRef() {
    if (!this.db) throw new Error("Database no inicializada");
    // Ruta de Realtime Database: /asistencia_logs
    return ref(this.db, 'asistencia_logs');
}
  
  // --- MÉTODOS DE UTILIDAD ---
  private showMessage(msg: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.message.set(msg);
    this.messageType.set(type);
    setTimeout(() => this.message.set(null), 5000);
  }

// --- FIREBASE: AUTENTICACIÓN ---
private setupAuthAndListeners(): void {
    // 1. Verificar si existe un token inicial (opcional, por si usas enlaces mágicos)
    if (this.initialAuthToken) {
        signInWithCustomToken(this.auth, this.initialAuthToken)
            .catch(err => {
                console.error("Fallo la autenticación con token inicial:", err);
                // 🛑 ELIMINADO: signInAnonymously(this.auth); 
                // Si falla el token, simplemente se queda en la pantalla de login.
            });
    } 
    // 🛑 ELIMINADO: el bloque 'else { signInAnonymously(...) }'
    // Ahora, si no hay token, no hace nada y espera a que el usuario ingrese sus datos.

    // 2. Listener de estado de autenticación
    onAuthStateChanged(this.auth, (user) => {
        this.currentUser.set(user);
        
        if (user) {
            // Solo si el usuario se loguea correctamente, cargamos los datos
            this.isAuthReady.set(true);
            this.isLoggedIn.set(true);
            this.setupDataListeners();
        } else {
            // Si no hay usuario, aseguramos que la UI muestre el Login
            this.isLoggedIn.set(false);
            this.isAuthReady.set(true); // Listo para mostrar el formulario de login
            
            // Limpiamos datos sensibles de la memoria
            this.allEmployees.set([]);
            this.allLogs.set([]);
        }
    });
}
  
  // Login de Administrador (Email/Password)
  login(): void {
    if (this.loginForm.invalid || !this.isFirebaseInitialized()) return;
    this.isLoading.set(true);

    const { email, password } = this.loginForm.value;

    if (email && password) {
      signInWithEmailAndPassword(this.auth, email, password)
        .then(() => {
          this.showMessage('Inicio de sesión exitoso.', 'success');
        })
        .catch(error => {
          console.error('Error de autenticación:', error);
          this.showMessage(`Error de inicio de sesión: ${error.message.includes('auth/invalid-credential') ? 'Credenciales incorrectas.' : 'Ha ocurrido un error.'}`, 'error');
        })
        .finally(() => this.isLoading.set(false));
    }
  }

  // Logout
  logout(): void {
    if (!this.isFirebaseInitialized()) return;
    signOut(this.auth)
      .then(() => {
        this.showMessage('Sesión cerrada correctamente. Por favor, vuelva a iniciar sesión.', 'info');
      })
      .catch(error => {
        console.error('Error al cerrar sesión:', error);
        this.showMessage('Error al cerrar sesión.', 'error');
      });
  }

// --- FIREBASE: LISTENERS DE DATOS (Realtime Database) ---
private setupDataListeners(): void {
    if (!this.currentUser() || !this.isFirebaseInitialized()) return;

    // ----------------------------------------------------
    // 🛑 Listener para Empleados (Maestro de datos)
    // ----------------------------------------------------
    onValue(this.empleadosRef, (snapshot) => {
        const empleadosMap = snapshot.val() || {};
        const employees: Empleado[] = [];

        Object.keys(empleadosMap).forEach(uid => {
            const data = empleadosMap[uid];
            
            const fechaAltaValue = data['fechaAlta'] || Date.now();
            
            employees.push({
                uid: uid,
                nombre: data['nombre'],
                numeroEmpleado: data['numeroEmpleado'],
                rol: data['rol'],
                fechaAlta: new Date(fechaAltaValue), 
            });
        });

        employees.sort((a, b) => a.nombre.localeCompare(b.nombre));
        
        this.allEmployees.set(employees);
        this.filterEmployees(); 
    }, error => {
        console.error('Error al escuchar empleados (RTDB):', error);
        this.showMessage('Error cargando la lista de empleados.', 'error');
    });

    // ----------------------------------------------------
    // 🛑 Listener para Logs de Asistencia (Registros del ESP32)
    // ----------------------------------------------------
    
    // 🛑 CAMBIO CLAVE: Usar query y orderByChild('timestamp')
    const logQuery = query(
        this.logsRef,
        orderByChild('timestamp') 
    );

    onValue(logQuery, (snapshot) => {
        const logsMap = snapshot.val() || {};
        const logs: AsistenciaLog[] = [];

        Object.keys(logsMap).forEach(key => {
            const data = logsMap[key];
            
            const timestampValue = data['timestamp'] as string;
            
            logs.push({
                id: key, 
                uid: data['uid'],
                nombre: data['nombre'],
                // 🛑 CORRECCIÓN FINAL: new Date() interpreta el string ISO con el offset -06:00
                timestamp: new Date(timestampValue), 
            } as AsistenciaLog);
        });
        
        // Ordenamos DESCENDENTE localmente:
        logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        this.allLogs.set(logs);
        this.applyLogFilters(true);
        this.calculateDailyUsage(logs);
    }, error => {
        console.error('Error al escuchar logs (RTDB):', error);
        this.showMessage('Error cargando los registros de asistencia.', 'error');
    });
}

// --- LÓGICA DE DASHBOARD (CORREGIDA) ---
private calculateDailyUsage(logs: AsistenciaLog[]): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Medianoche local de HOY

    const usageMap = new Map<string, number>();
    
    // Función auxiliar: Devuelve "YYYY-MM-DD" local
    const createDateKey = (date: Date): string => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0'); 
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // 1. Inicializar los últimos 7 días
    for (let i = 6; i >= 0; i--) { 
        const d = new Date(today);
        d.setDate(today.getDate() - i); 
        const dateKey = createDateKey(d); 
        usageMap.set(dateKey, 0);
    }

    // 2. Contar logs
    logs.forEach(log => {
        if (!log.timestamp) return; // Protección extra

        const cleanLogDate = new Date(log.timestamp); 
        cleanLogDate.setHours(0, 0, 0, 0); // Forzar a medianoche LOCAL
        
        const logDateKey = createDateKey(cleanLogDate);

        if (usageMap.has(logDateKey)) {
            usageMap.set(logDateKey, usageMap.get(logDateKey)! + 1);
        }
    });

    // 3. Ordenar datos
    let dailyData = Array.from(usageMap.entries())
        .map(([dateKey, count]) => ({ dateKey, count }));

    dailyData.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    
    // 🛑 4. Generar etiquetas (AQUÍ ESTABA EL ERROR)
    const finalDailyData: DailyUsage[] = dailyData.map(item => {
        // Desglosamos "2025-11-22" en partes numéricas
        const [year, month, day] = item.dateKey.split('-').map(Number);
        
        // Creamos la fecha usando el constructor (año, mes-1, dia).
        // Este constructor SIEMPRE usa la hora local, no UTC.
        const localDate = new Date(year, month - 1, day); 

        return {
            date: localDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
            count: item.count,
        };
    });

    this.dailyUsageData.set(finalDailyData);
}

// --- LÓGICA DE GESTIÓN DE EMPLEADOS (CRUD) ---
 
// Búsqueda en memoria
filterEmployees(): void {
    // 🛑 CORRECCIÓN 1: Acceder a la propiedad como string, no como Signal
    const term = this.employeeSearchTerm.toLowerCase().trim(); 
    if (!term) {
        this.filteredEmployees.set(this.allEmployees());
        return;
    }
    
    const results = this.allEmployees().filter(emp => 
        emp.nombre.toLowerCase().includes(term) ||
        emp.numeroEmpleado.toLowerCase().includes(term)
    );
    this.filteredEmployees.set(results);
}

// Abrir Modal (Crear o Editar)
openEmployeeModal(employee?: Empleado): void {
    this.employeeForm.reset();
    
    if (employee) {
        // EDITAR
        this.isEditingMode.set(true); // 🛑 FIJAR MODO: EDITAR
        
        this.employeeForm.setValue({
            uid: employee.uid,
            nombre: employee.nombre,
            numeroEmpleado: employee.numeroEmpleado,
            rol: employee.rol,
            fechaAlta: employee.fechaAlta.getTime(), // Convertido a timestamp numérico
        });
        
        // Deshabilitar UID y fechaAlta para edición
        this.employeeForm.get('uid')?.disable();
        this.employeeForm.get('fechaAlta')?.disable();
    } else {
        // CREAR
        this.isEditingMode.set(false); // 🛑 FIJAR MODO: CREAR
        
        this.employeeForm.get('uid')?.enable();
        this.employeeForm.setValue({
            uid: '',
            nombre: '',
            numeroEmpleado: '',
            rol: 'Conductor',
            fechaAlta: Date.now(), 
        });
    }
    this.isEmployeeModalOpen.set(true);
}

// Cerrar Modal
closeEmployeeModal(): void {
    this.isEmployeeModalOpen.set(false);
    this.isEditingMode.set(false); // 🛑 LIMPIAR EL MODO
    this.employeeForm.get('uid')?.enable(); 
    this.employeeForm.get('fechaAlta')?.enable();
}

// Guardar Empleado (Crear/Actualizar)
async saveEmployee(): Promise<void> {
    if (this.employeeForm.invalid || this.isLoading() || !this.isFirebaseInitialized()) return;
    this.isLoading.set(true);

    // 🛑 CORRECCIÓN 3: Castear a 'any' para evitar problemas de inferencia de tipo en getRawValue()
    const formValue = this.employeeForm.getRawValue() as any; 
    const isEditing = !!this.allEmployees().find(e => e.uid === formValue.uid);

    // 🛑 Manejo de la Fecha: Aseguramos que es un objeto Date antes de convertir a string
    const fechaAltaOriginal = formValue.fechaAlta ? new Date(formValue.fechaAlta) : new Date();

    const employeeDataToSave = {
        uid: formValue.uid!,
        nombre: formValue.nombre!,
        numeroEmpleado: formValue.numeroEmpleado!,
        rol: formValue.rol as 'Conductor' | 'Supervisor' | 'Administrador',
        // Guardar la fecha como string ISO (recomendado para RTDB)
        fechaAlta: isEditing ? fechaAltaOriginal.toISOString() : new Date().toISOString(),
    };
    
    try {
        // 🛑 RTDB: Obtener la referencia al nodo específico /empleados/{uid}
        const employeeNodeRef = ref(this.db, `empleados/${employeeDataToSave.uid}`);

        if (isEditing) {
            // Actualizar (Usar 'update' para campos específicos)
            await update(employeeNodeRef, {
                nombre: employeeDataToSave.nombre,
                numeroEmpleado: employeeDataToSave.numeroEmpleado,
                rol: employeeDataToSave.rol,
            });
            this.showMessage(`Empleado ${employeeDataToSave.nombre} actualizado.`, 'success');
        } else {
            // Crear (Usar 'set' para crear el nodo completo con el UID)
            await set(employeeNodeRef, employeeDataToSave);
            this.showMessage(`Nuevo empleado ${employeeDataToSave.nombre} registrado.`, 'success');
        }

        this.closeEmployeeModal();
    } catch (error) {
        console.error('Error al guardar empleado:', error);
        this.showMessage(`Error al guardar empleado: ${error instanceof Error ? error.message : 'Error desconocido'}`, 'error');
    } finally {
        this.isLoading.set(false);
    }
}

// Eliminar Empleado
async deleteEmployee(employee: Empleado): Promise<void> {
    if (!this.isFirebaseInitialized()) return;
    
    const confirmation = window.prompt(`Escriba "ELIMINAR ${employee.uid}" para confirmar la eliminación de ${employee.nombre}.`);
    
    if (confirmation === `ELIMINAR ${employee.uid}`) {
        this.isLoading.set(true);
        try {
            // 🛑 RTDB: Usar 'remove' con la referencia al nodo
            const employeeNodeRef = ref(this.db, `empleados/${employee.uid}`);
            await remove(employeeNodeRef);
            
            this.showMessage(`Empleado ${employee.nombre} eliminado.`, 'success');
        } catch (error) {
            console.error('Error al eliminar empleado:', error);
            this.showMessage('Error al eliminar empleado.', 'error');
        } finally {
            this.isLoading.set(false);
        }
    } else if (confirmation !== null) {
        this.showMessage('Confirmación de eliminación incorrecta. Operación cancelada.', 'info');
    }
}

// --- LÓGICA DE FILTRADO DE ASISTENCIA ---

applyLogFilters(isInitialLoad: boolean = false): void {
  const filters = this.logFilterForm.value;
  let results = [...this.allLogs()]; // Copia inicial
  
  // 1. Filtrar por Nombre
  if (filters.employeeName) {
    const nameTerm = filters.employeeName.toLowerCase().trim();
    
    results = results.filter(log => 
      // Verificar que log.nombre NO sea null
      log.nombre !== null && log.nombre.toLowerCase().includes(nameTerm)
    );
  }
  
  // 2. Filtrar por Rango de Fechas (CORRECCIÓN CLAVE DE ZONA HORARIA)
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  // 🛑 CORRECCIÓN: Usamos el constructor Date(año, mes-1, día) para crear la fecha en HORA LOCAL.

  if (filters.startDate) {
      // filters.startDate viene como "YYYY-MM-DD"
      const [y, m, d] = filters.startDate.split('-').map(Number);
      // Creamos el inicio del día local (00:00:00)
      startDate = new Date(y, m - 1, d, 0, 0, 0, 0); 
  }

  if (filters.endDate) {
      const [y, m, d] = filters.endDate.split('-').map(Number);
      // Creamos el final del día local (23:59:59.999)
      endDate = new Date(y, m - 1, d, 23, 59, 59, 999); 
  }

  if (startDate || endDate) {
    results = results.filter(log => {
      // log.timestamp ya es un objeto Date válido
      const logTime = log.timestamp.getTime(); 
      
      const startMatch = startDate ? logTime >= startDate.getTime() : true;
      const endMatch = endDate ? logTime <= endDate.getTime() : true;
      return startMatch && endMatch;
    });
  }

  // El listener ya asegura el orden descendente
  this.filteredLogs.set(results);
  if (!isInitialLoad) {
    this.currentPage.set(1); // Reiniciar la paginación al aplicar nuevos filtros
  }
}

clearLogFilters(): void {
  this.logFilterForm.reset({
    employeeName: '',
    startDate: '',
    endDate: '',
  });
  this.applyLogFilters(); // Aplicar filtros vacíos para mostrar todo
  this.currentPage.set(1);
}

  // --- LÓGICA DE PAGINACIÓN DE ASISTENCIA ---

  nextLogPage(): void {
    if (this.currentPage() < this.totalLogPages()) {
      this.currentPage.update(page => page + 1);
    }
  }

  previousLogPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(page => page - 1);
    }
  }
}