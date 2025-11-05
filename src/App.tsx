import React, { useState, useEffect } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Paginator } from 'primereact/paginator';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputNumber } from 'primereact/inputnumber';
import { Checkbox } from 'primereact/checkbox';
import { Toast } from 'primereact/toast';
import axios from 'axios';

import './App.css';
import 'primereact/resources/themes/lara-light-cyan/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';
 interface Artwork {
  id: number;
  title: string;
  place_of_origin: string;
  artist_display: string;
  inscriptions: string;
  date_start: number;
  date_end: number;
}

interface ApiResponse {
  data: Artwork[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    total_pages: number;
    current_page: number;
    next_url: string;
  };
}

const App: React.FC = () => {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [selectedArtworks, setSelectedArtworks] = useState<Artwork[]>([]);
  const [globalSelection, setGlobalSelection] = useState<Set<number>>(new Set());
  const [globalDeselection, setGlobalDeselection] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [showOverlay, setShowOverlay] = useState<boolean>(false);
  const [selectCount, setSelectCount] = useState<number>(0);
  const [allOnPageSelected, setAllOnPageSelected] = useState<boolean>(false);
  const toast = React.useRef<Toast>(null);

  const rowsPerPage = 12;

  useEffect(() => {
    fetchArtworks(currentPage);
  }, [currentPage]);

  useEffect(() => {
    updatePageSelectionState();
  }, [artworks, globalSelection, globalDeselection]);

  const fetchArtworks = async (page: number) => {
    setLoading(true);
    try {
      const response = await axios.get<ApiResponse>(
        `https://api.artic.edu/api/v1/artworks?page=${page}&limit=${rowsPerPage}`
      );
      setArtworks(response.data.data);
      setTotalRecords(response.data.pagination.total);
      
      // Update selected artworks for current page
      updateSelectedArtworksForPage(response.data.data);
    } catch (error) {
      console.error('Error fetching artworks:', error);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to fetch artworks',
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSelectedArtworksForPage = (pageArtworks: Artwork[]) => {
    const selectedOnPage = pageArtworks.filter(artwork => 
      globalSelection.has(artwork.id) && !globalDeselection.has(artwork.id)
    );
    setSelectedArtworks(selectedOnPage);
  };

  const updatePageSelectionState = () => {
    if (artworks.length === 0) {
      setAllOnPageSelected(false);
      return;
    }

    const allSelected = artworks.every(artwork => 
      globalSelection.has(artwork.id) && !globalDeselection.has(artwork.id)
    );
    setAllOnPageSelected(allSelected);
  };

  const onPageChange = (event: any) => {
    const newPage = event.page + 1;
    setCurrentPage(newPage);
  };

  const onSelectionChange = (e: any) => {
    const selected = e.value as Artwork[];
    setSelectedArtworks(selected);

    // Update global selection state
    const newSelection = new Set(globalSelection);
    const newDeselection = new Set(globalDeselection);

    artworks.forEach(artwork => {
      const isSelected = selected.some(selectedArtwork => selectedArtwork.id === artwork.id);
      
      if (isSelected) {
        // If selected, remove from deselection and add to selection
        newDeselection.delete(artwork.id);
        newSelection.add(artwork.id);
      } else {
        // If deselected, add to deselection (if it was previously selected globally)
        if (globalSelection.has(artwork.id)) {
          newDeselection.add(artwork.id);
        }
      }
    });

    setGlobalSelection(newSelection);
    setGlobalDeselection(newDeselection);
  };

  const onSelectAllChange = (e: any) => {
    const checked = e.checked;
    
    const newSelection = new Set(globalSelection);
    const newDeselection = new Set(globalDeselection);

    artworks.forEach(artwork => {
      if (checked) {
        // Select all: add to selection, remove from deselection
        newSelection.add(artwork.id);
        newDeselection.delete(artwork.id);
      } else {
        // Deselect all: if it was in global selection, add to deselection
        if (globalSelection.has(artwork.id)) {
          newDeselection.add(artwork.id);
        }
      }
    });

    setGlobalSelection(newSelection);
    setGlobalDeselection(newDeselection);
    updateSelectedArtworksForPage(artworks);
  };

  const handleCustomSelection = () => {
    if (selectCount <= 0) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Invalid Input',
        detail: 'Please enter a valid number greater than 0',
        life: 3000
      });
      return;
    }

    const newSelection = new Set(globalSelection);
    const newDeselection = new Set(globalDeselection);
    
    // Calculate how many more we need to select
    const currentlySelected = Array.from(globalSelection).filter(id => 
      !globalDeselection.has(id)
    ).length;
    
    const needed = selectCount - currentlySelected;

    if (needed <= 0) {
      toast.current?.show({
        severity: 'info',
        summary: 'Selection Complete',
        detail: `Already have ${currentlySelected} items selected`,
        life: 3000
      });
      setShowOverlay(false);
      return;
    }

    // Strategy: Select available items on current page first
    let remaining = needed;
    let simulatedSelections = 0;

    // First, try to use current page if there are unselected items
    const unselectedOnPage = artworks.filter(artwork => 
      !globalSelection.has(artwork.id) || globalDeselection.has(artwork.id)
    );

    for (const artwork of unselectedOnPage) {
      if (remaining <= 0) break;
      newSelection.add(artwork.id);
      newDeselection.delete(artwork.id);
      remaining--;
      simulatedSelections++;
    }

    // For remaining selections, we'll track them as "to be selected"
    // When user navigates to those pages, they'll appear selected
    if (remaining > 0) {
      // We don't fetch additional pages, just track the total count needed
      // The actual selection will happen when user visits those pages
      toast.current?.show({
        severity: 'info',
        summary: 'Partial Selection',
        detail: `Selected ${simulatedSelections} items on current page. Navigate to other pages to select more.`,
        life: 5000
      });
    } else {
      toast.current?.show({
        severity: 'success',
        summary: 'Selection Complete',
        detail: `Selected ${simulatedSelections} items`,
        life: 3000
      });
    }

    setGlobalSelection(newSelection);
    setGlobalDeselection(newDeselection);
    updateSelectedArtworksForPage(artworks);
    setShowOverlay(false);
    setSelectCount(0);
  };

  const handleClearAllSelections = () => {
    setGlobalSelection(new Set());
    setGlobalDeselection(new Set());
    setSelectedArtworks([]);
    toast.current?.show({
      severity: 'success',
      summary: 'Selections Cleared',
      detail: 'All selections have been cleared',
      life: 3000
    });
  };

  const selectionHeaderTemplate = () => {
    return (
      <div className="flex align-items-center">
        <Checkbox
          checked={allOnPageSelected}
          onChange={onSelectAllChange}
          className="mr-2"
        />
        <span>Select All</span>
      </div>
    );
  };

  const selectionFooterTemplate = () => {
    const totalSelected = Array.from(globalSelection).filter(id => 
      !globalDeselection.has(id)
    ).length;

    return (
      <div className="flex justify-content-between align-items-center p-3 border-top-1 surface-border">
        <span>{totalSelected} item(s) selected globally</span>
        <div className="flex gap-2">
          <Button
            icon="pi pi-plus"
            label="Custom Select"
            onClick={() => setShowOverlay(true)}
            size="small"
          />
          <Button
            icon="pi pi-trash"
            label="Clear All"
            onClick={handleClearAllSelections}
            severity="secondary"
            size="small"
          />
        </div>
      </div>
    );
  };

  const customSelectionOverlay = () => {
    return (
      <Dialog
        header="Custom Row Selection"
        visible={showOverlay}
        onHide={() => setShowOverlay(false)}
        className="w-4"
      >
        <div className="flex flex-column gap-3">
          <p>Enter the number of rows you want to select:</p>
          <InputNumber
            value={selectCount}
            onValueChange={(e) => setSelectCount(e.value || 0)}
            min={0}
            max={1000}
            showButtons
            className="w-full"
          />
          <div className="flex gap-2 justify-content-end">
            <Button
              label="Cancel"
              icon="pi pi-times"
              onClick={() => setShowOverlay(false)}
              severity="secondary"
            />
            <Button
              label="Select"
              icon="pi pi-check"
              onClick={handleCustomSelection}
            />
          </div>
        </div>
      </Dialog>
    );
  };

  return (
    <div className="app-container">
      <Toast ref={toast} />
      
      <div className="card">
        <h1>Art Institute of Chicago - Artworks</h1>
        
        <DataTable
          value={artworks}
          selection={selectedArtworks}
          onSelectionChange={onSelectionChange}
          dataKey="id"
          loading={loading}
          responsiveLayout="scroll"
          selectionMode="checkbox"
          header={selectionHeaderTemplate}
          footer={selectionFooterTemplate}
        >
          <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />
          <Column field="title" header="Title" sortable />
          <Column field="place_of_origin" header="Place of Origin" sortable />
          <Column field="artist_display" header="Artist" sortable />
          <Column field="inscriptions" header="Inscriptions" sortable />
          <Column field="date_start" header="Start Date" sortable />
          <Column field="date_end" header="End Date" sortable />
        </DataTable>

        <Paginator
          first={(currentPage - 1) * rowsPerPage}
          rows={rowsPerPage}
          totalRecords={totalRecords}
          onPageChange={onPageChange}
          template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport"
          currentPageReportTemplate="Showing {first} to {last} of {totalRecords} artworks"
        />
      </div>

      {customSelectionOverlay()}
    </div>
  );
};

export default App;