import './styles/main.css';

import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import zoomPlugin from 'chartjs-plugin-zoom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import Papa from 'papaparse';

jsPDF.prototype.autoTable = function (...args) {
  return autoTable(this, ...args);
};
jsPDF.API = jsPDF.API || {};
jsPDF.API.autoTable = function (...args) {
  return autoTable(this, ...args);
};
Chart.register(...registerables, ChartDataLabels, zoomPlugin);

if (typeof window !== 'undefined') {
  window.Chart = Chart;
  window.ChartDataLabels = ChartDataLabels;
  window.ChartZoom = zoomPlugin;
  window.html2canvas = html2canvas;
  window.jsPDF = jsPDF;
  window.jspdf = window.jspdf || {};
  window.jspdf.jsPDF = jsPDF;
  window.jspdf.autoTable = autoTable;
  window.JSZip = JSZip;
  window.Papa = Papa;
}

import './js/app.js';
import './js/components/student-result-details.js';
import './js/components/group-result-details.js';
import './js/utils/perf.js';

